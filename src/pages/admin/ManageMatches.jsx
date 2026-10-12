import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/StatusChip';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import { formatDate, toLocalInput, fromLocalInput } from '../../utils/standings';
import supabase from '../../lib/supabase';

const EMPTY = { home_team_id: '', away_team_id: '', week: '1', scheduled_at: '', venue: '' };

export default function ManageMatches() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [odds, setOdds] = useState({}); // matchId -> { h, d, a }
  const [savingOdds, setSavingOdds] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('matches').select('*').order('scheduled_at'),
    ]);
    const rows = m.data || [];
    setTeams(t.data || []);
    setMatches(rows);
    setOdds((prev) => {
      const next = { ...prev };
      rows.forEach((row) => {
        if (!next[row.id]) {
          next[row.id] = {
            h: row.home_odds != null ? String(row.home_odds) : '',
            d: row.draw_odds != null ? String(row.draw_odds) : '',
            a: row.away_odds != null ? String(row.away_odds) : '',
          };
        }
      });
      return next;
    });
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.home_team_id || !form.away_team_id || !form.scheduled_at) {
      setMessage({ severity: 'error', text: 'Please pick both teams and a date.' });
      return;
    }
    if (form.home_team_id === form.away_team_id) {
      setMessage({ severity: 'error', text: 'A team cannot play against itself.' });
      return;
    }
    const payload = {
      home_team_id: form.home_team_id,
      away_team_id: form.away_team_id,
      week: Number(form.week) || 1,
      scheduled_at: fromLocalInput(form.scheduled_at),
      venue: form.venue || null,
    };
    if (editingId) {
      const { error } = await supabase.from('matches').update(payload).eq('id', editingId);
      if (error) setMessage({ severity: 'error', text: error.message });
      else setMessage({ severity: 'success', text: 'Match updated.' });
    } else {
      const { error } = await supabase.from('matches').insert(payload);
      if (error) setMessage({ severity: 'error', text: error.message });
      else setMessage({ severity: 'success', text: 'Match scheduled.' });
    }
    reset();
    load();
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setForm({
      home_team_id: m.home_team_id,
      away_team_id: m.away_team_id,
      week: String(m.week),
      scheduled_at: toLocalInput(m.scheduled_at),
      venue: m.venue || '',
    });
  };

  const remove = async (m) => {
    if (!window.confirm('Delete this match and all its events?')) return;
    const { error } = await supabase.from('matches').delete().eq('id', m.id);
    if (error) setMessage({ severity: 'error', text: error.message });
    else setMessage({ severity: 'success', text: 'Match deleted.' });
    reset();
    load();
  };

  const numOrNull = (v) => (v === '' ? null : Number(v));

  const saveOdds = async (m) => {
    const o = odds[m.id] || {};
    const payload = {
      home_odds: numOrNull(o.h),
      draw_odds: numOrNull(o.d),
      away_odds: numOrNull(o.a),
    };
    const vals = [payload.home_odds, payload.draw_odds, payload.away_odds].filter((v) => v != null);
    if (vals.length > 0 && vals.length < 3) {
      setMessage({ severity: 'error', text: 'Set all three odds (Home / Draw / Away) or clear them all to close betting.' });
      return;
    }
    if (vals.some((v) => v < 1.01)) {
      setMessage({ severity: 'error', text: 'Odds must be at least 1.01.' });
      return;
    }
    setSavingOdds(m.id);
    const { error } = await supabase.from('matches').update(payload).eq('id', m.id);
    setSavingOdds(null);
    if (error) setMessage({ severity: 'error', text: error.message });
    else
      setMessage({
        severity: 'success',
        text:
          payload.home_odds == null
            ? 'Betting closed for this match.'
            : 'Odds saved — this match is now open on the Betting board.',
      });
    load();
  };

  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'TBD';

  if (!loaded) return <LoadingSpinner message="Loading matches…" />;

  return (
    <div>
      <PageHeader title="Manage Matches" subtitle="Schedule, edit or remove fixtures" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard title={editingId ? 'Edit match' : 'Schedule match'} sx={{ mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr) auto' }, alignItems: 'center' }}>
          <TextField
            label="Home team"
            select
            required
            value={form.home_team_id}
            onChange={(e) => setForm({ ...form, home_team_id: e.target.value })}
          >
            {teams.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Away team"
            select
            required
            value={form.away_team_id}
            onChange={(e) => setForm({ ...form, away_team_id: e.target.value })}
          >
            {teams.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Week"
            type="number"
            required
            value={form.week}
            onChange={(e) => setForm({ ...form, week: e.target.value })}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="Date & time"
            type="datetime-local"
            required
            value={form.scheduled_at}
            onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
          />
          <TextField label="Venue" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button type="submit" variant="contained" startIcon={<AddRounded />}>
              {editingId ? 'Save' : 'Schedule'}
            </Button>
            {editingId && (
              <Button variant="outlined" onClick={reset}>
                Cancel
              </Button>
            )}
          </Box>
        </Box>
      </GlassCard>

      <GlassCard title={`Fixtures (${matches.length})`}>
        {matches.length === 0 ? (
          <EmptyState message="No matches scheduled." />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Week</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Match</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Venue</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Score</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Odds (H / D / A)</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {matches.map((m) => (
                  <TableRow key={m.id} hover>
                    <TableCell>{m.week}</TableCell>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {teamName(m.home_team_id)} vs {teamName(m.away_team_id)}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{formatDate(m.scheduled_at, true)}</TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{m.venue || '—'}</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>
                      {m.status === 'scheduled' ? '—' : `${m.home_score}–${m.away_score}`}
                    </TableCell>
                    <TableCell>
                      <StatusChip status={m.status} />
                    </TableCell>
                    <TableCell>
                      {m.status === 'scheduled' ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {['h', 'd', 'a'].map((k) => (
                            <TextField
                              key={k}
                              variant="standard"
                              size="small"
                              type="number"
                              inputProps={{ min: 1.01, step: 0.01, style: { width: 54, fontWeight: 700 } }}
                              placeholder={k.toUpperCase()}
                              value={odds[m.id]?.[k] ?? ''}
                              onChange={(e) =>
                                setOdds((prev) => ({
                                  ...prev,
                                  [m.id]: { h: '', d: '', a: '', ...(prev[m.id] || {}), [k]: e.target.value },
                                }))
                              }
                            />
                          ))}
                          <Button
                            size="small"
                            variant="outlined"
                            disabled={savingOdds === m.id}
                            onClick={() => saveOdds(m)}
                          >
                            {savingOdds === m.id ? '…' : 'Save'}
                          </Button>
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {m.home_odds ? `${m.home_odds} / ${m.draw_odds} / ${m.away_odds}` : '—'}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => startEdit(m)}>
                        Edit
                      </Button>
                      <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => remove(m)}>
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </GlassCard>
    </div>
  );
}
