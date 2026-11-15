import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Select from '@mui/material/Select';
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
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { formatDate, toLocalInput, fromLocalInput } from '../../utils/standings';
import supabase from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const EMPTY = { home_team_id: '', away_team_id: '', week: '1', scheduled_at: '', venue: '' };

export default function ManageMatches() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = profile?.role === 'admin';
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [odds, setOdds] = useState({}); // matchId -> { h, d, a }
  const [savingOdds, setSavingOdds] = useState(null);
  const [officials, setOfficials] = useState([]);
  const [commissioners, setCommissioners] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [workFilter, setWorkFilter] = useState('all');
  const [seasonYear, setSeasonYear] = useState('all');

  const load = useCallback(async () => {
    const [t, m, o, c] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('matches').select('*').order('scheduled_at'),
      supabase.from('officials').select('*').order('name'),
      supabase.from('profiles').select('id, full_name').eq('role', 'commissioner'),
    ]);
    const rows = m.data || [];
    setTeams(t.data || []);
    setMatches(rows);
    setOfficials(o.data || []);
    setCommissioners(c.data || []);
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
  useAutoRefresh(load, 30000);

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

  // Creates the full season: every team vs every team, home and away.
  // Admin then only has to set a date and venue for each game.
  const generateFixtures = async () => {
    if (teams.length < 4 || teams.length % 2 !== 0) {
      setMessage({ severity: 'error', text: 'Add at least 4 teams (an even number) before generating the fixture.' });
      return;
    }
    const total = teams.length * (teams.length - 1);
    const warn =
      matches.length > 0
        ? `This DELETES all ${matches.length} existing matches and creates the full ${total}-match schedule. Continue?`
        : `Create the full ${total}-match schedule? You can then set a date and venue for each game.`;
    if (!window.confirm(warn)) return;

    const arr = teams.map((t) => t.id);
    const firstHalf = [];
    for (let r = 0; r < arr.length - 1; r++) {
      const round = [];
      for (let i = 0; i < arr.length / 2; i++) {
        const a = arr[i];
        const b = arr[arr.length - 1 - i];
        round.push(r % 2 === 0 ? { home: a, away: b } : { home: b, away: a });
      }
      firstHalf.push(round);
      arr.splice(1, 0, arr.pop());
    }
    const allRounds = [...firstHalf, ...firstHalf.map((rd) => rd.map((m) => ({ home: m.away, away: m.home })))];

    const rows = [];
    allRounds.forEach((round, ri) => {
      round.forEach(({ home, away }) =>
        rows.push({
          home_team_id: home,
          away_team_id: away,
          week: ri + 1,
          scheduled_at: null,
          venue: null,
          status: 'scheduled',
        })
      );
    });

    const { error: delErr } = await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) {
      setMessage({ severity: 'error', text: delErr.message });
      return;
    }
    const { error } = await supabase.from('matches').insert(rows);
    if (error) setMessage({ severity: 'error', text: error.message });
    else
      setMessage({
        severity: 'success',
        text: `Full fixture created — ${rows.length} matches, no dates. Now set a date and venue for each game.`,
      });
    load();
  };

  // Assign an official to a match. If the official is still booked on
  // another match that has not ended, ask to move them (clear old first).
  const assignReferee = async (m, refId) => {
    if (refId) {
      const conflict = matches.find((x) => x.id !== m.id && x.referee_id === refId && x.status !== 'finished');
      const official = officials.find((o) => o.id === refId);
      if (conflict) {
        const ok = window.confirm(
          `${official?.name || 'That official'} is already assigned to ${teamName(conflict.home_team_id)} v ${teamName(
            conflict.away_team_id
          )} and that match has not ended. Move them to this match instead?`
        );
        if (!ok) return;
        await supabase.from('matches').update({ referee_id: null }).eq('id', conflict.id);
      }
    }
    const { error } = await supabase.from('matches').update({ referee_id: refId || null }).eq('id', m.id);
    if (error) setMessage({ severity: 'error', text: error.message });
    else setMessage({ severity: 'success', text: refId ? 'Official assigned.' : 'Official unassigned.' });
    load();
  };

  // Assign a commissioner to officiate a match. Same one-at-a-time rule as
  // officials: a commissioner can hold many matches across the season, but
  // only one that has not ended at a time — assigning moves them.
  const assignCommissioner = async (m, cid) => {
    if (cid) {
      const conflict = matches.find((x) => x.id !== m.id && x.commissioner_id === cid && x.status !== 'finished');
      const comm = commissioners.find((c) => c.id === cid);
      if (conflict) {
        const ok = window.confirm(
          `${comm?.full_name || 'That commissioner'} is already assigned to ${teamName(conflict.home_team_id)} v ${teamName(
            conflict.away_team_id
          )} and that match has not ended. Move them to this match instead?`
        );
        if (!ok) return;
        await supabase.from('matches').update({ commissioner_id: null }).eq('id', conflict.id);
      }
    }
    const { error } = await supabase.from('matches').update({ commissioner_id: cid || null }).eq('id', m.id);
    if (error) setMessage({ severity: 'error', text: error.message });
    else setMessage({ severity: 'success', text: cid ? 'Commissioner assigned to officiate.' : 'Commissioner unassigned.' });
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
  // Commissioners see ALL upcoming matches, but only the ones assigned
  // to them are clickable (they open the live control for that match).
  // Assigned matches sort to the top: live first, then by date.
  const myId = profile?.id;
  const statusRank = (st) => (st === 'live' ? 0 : st === 'scheduled' ? 1 : 2);
  const assigned = matches.filter((m) => m.commissioner_id === myId);
  const years = [...new Set(assigned.map((m) => String(new Date(m.scheduled_at).getFullYear())))].sort().reverse();
  const seasonMatches = assigned.filter((m) => seasonYear === 'all' || String(new Date(m.scheduled_at).getFullYear()) === seasonYear);
  const myMatches = seasonMatches
    .filter((m) => workFilter === 'all' || m.status === workFilter)
    .sort((a, b) => statusRank(a.status) - statusRank(b.status) || new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const otherUpcoming = matches
    .filter((m) => m.commissioner_id !== myId && m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Manage Matches' : 'Matches'}
        subtitle={
          isAdmin
            ? 'Schedule, edit or remove fixtures'
            : 'Your assigned matches are at the top — tap one to open it. All other upcoming fixtures are view-only.'
        }
      />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {isAdmin && (
      <>
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

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button variant="outlined" onClick={generateFixtures}>
          Generate full fixture ({teams.length * (teams.length - 1)} matches)
        </Button>
        <Typography variant="body2" color="text.secondary">
          Creates every home-and-away game. You only set the date, venue and official for each one.
        </Typography>
      </Box>
      </>
      )}

      <GlassCard title={isAdmin ? `Fixtures (${matches.length})` : 'Matches'}>
        {isAdmin ? (
          matches.length === 0 ? (
          <EmptyState message="No matches yet — generate the full fixture above." />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Week</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Match</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Venue</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Official</TableCell>
                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Commissioner</TableCell>
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
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                      {m.scheduled_at ? formatDate(m.scheduled_at, true) : 'Date TBC'}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{m.venue || '—'}</TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        value={m.referee_id || ''}
                        onChange={(e) => assignReferee(m, e.target.value)}
                        displayEmpty
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="">— none —</MenuItem>
                        {officials.map((o) => (
                          <MenuItem key={o.id} value={o.id}>
                            {o.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      {profile?.role === 'admin' ? (
                        <Select
                          size="small"
                          value={m.commissioner_id || ''}
                          onChange={(e) => assignCommissioner(m, e.target.value)}
                          displayEmpty
                          sx={{ minWidth: 150 }}
                        >
                          <MenuItem value="">— none —</MenuItem>
                          {commissioners.map((c) => (
                            <MenuItem key={c.id} value={c.id}>
                              {c.full_name}
                            </MenuItem>
                          ))}
                        </Select>
                      ) : (
                        <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>
                          {commissioners.find((c) => c.id === m.commissioner_id)?.full_name || '—'}
                        </Typography>
                      )}
                    </TableCell>
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
                      {m.status === 'finished' && <Button size="small" onClick={() => navigate(`/commissioner/match-center/live/${m.id}`)}>Report / corrections</Button>}
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
          )
        ) : (
          <>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
              {[
                ['Assigned', seasonMatches.length],
                ['Completed', seasonMatches.filter((m) => m.status === 'finished').length],
                ['Upcoming', seasonMatches.filter((m) => m.status === 'scheduled').length],
                ['Live', seasonMatches.filter((m) => m.status === 'live').length],
              ].map(([label, count]) => <Box key={label} sx={{ flex: '1 1 100px', p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Typography variant="h5">{count}</Typography><Typography variant="caption">{label}</Typography></Box>)}
            </Box>
            <TextField select label="Match year" size="small" value={seasonYear} onChange={(e) => setSeasonYear(e.target.value)} sx={{ minWidth: 160, mb: 1 }} helperText="Calendar-year filter for your match history">
              <MenuItem value="all">All years</MenuItem>
              {years.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
            </TextField>
            <Tabs value={workFilter} onChange={(_, v) => setWorkFilter(v)} variant="fullWidth" sx={{ mb: 2, '& .MuiTab-root': { minWidth: 0, px: 0.5, fontSize: { xs: 11, sm: 14 } } }}>
              <Tab value="all" label="All" /><Tab value="scheduled" label="Upcoming" /><Tab value="live" label="Live" /><Tab value="finished" label="Completed" />
            </Tabs>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              My assigned matches ({myMatches.length})
            </Typography>
            {myMatches.length === 0 ? (
              <EmptyState message="No assigned matches in this view. Try another tab or year." />
            ) : (
              <>
              <Box sx={{ display: { xs: 'flex', sm: 'none' }, flexDirection: 'column', gap: 1.5 }}>
                {myMatches.map((m) => <Box key={m.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}><Typography variant="caption">Week {m.week}</Typography><StatusChip status={m.status} /></Box>
                  <Typography sx={{ fontWeight: 800 }}>{teamName(m.home_team_id)}</Typography>
                  <Typography sx={{ fontWeight: 900, color: 'primary.main', my: 0.5 }}>{m.status === 'scheduled' ? 'vs' : `${m.home_score} – ${m.away_score}`}</Typography>
                  <Typography sx={{ fontWeight: 800 }}>{teamName(m.away_team_id)}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{formatDate(m.scheduled_at, true)}</Typography>
                  <Typography variant="body2" color="text.secondary">{m.venue || 'Venue TBC'}</Typography>
                  {m.status === 'finished' && <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>{m.report_finalized_at ? 'Finalised' : 'Awaiting report'}</Typography>}
                  <Button fullWidth variant="outlined" sx={{ mt: 1 }} endIcon={<ChevronRightRounded />} onClick={() => navigate(`/commissioner/match-center/live/${m.id}`)}>{m.status === 'finished' ? 'View match record' : m.status === 'live' ? 'Continue live match' : 'Open match'}</Button>
                </Box>)}
              </Box>
              <TableContainer sx={{ display: { xs: 'none', sm: 'block' }, overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Week</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Match</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date &amp; time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Venue</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Official</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Score</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        Open
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {myMatches.map((m) => (
                      <TableRow
                        key={m.id}
                        hover
                        onClick={() => navigate(`/commissioner/match-center/live/${m.id}`)}
                        sx={{ cursor: 'pointer' }}
                      >
                        <TableCell>{m.week}</TableCell>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {teamName(m.home_team_id)} vs {teamName(m.away_team_id)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          {m.scheduled_at ? formatDate(m.scheduled_at, true) : 'Date TBC'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{m.venue || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {officials.find((o) => o.id === m.referee_id)?.name || '—'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>
                          {m.status === 'scheduled' ? '—' : `${m.home_score}–${m.away_score}`}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={m.status} />
                          {m.status === 'finished' && <Typography variant="caption" display="block">{m.report_finalized_at ? 'Finalised' : 'Awaiting report'}</Typography>}
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" endIcon={<ChevronRightRounded />}>
                            Open
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              </>
            )}
            {(workFilter === 'all' || workFilter === 'scheduled') && <>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: 4, mb: 1 }}>
              All upcoming matches ({otherUpcoming.length})
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              View only — only your assigned matches above can be opened.
            </Typography>
            {otherUpcoming.length === 0 ? (
              <EmptyState message="No other upcoming matches right now." />
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Week</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Match</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date &amp; time</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Venue</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Official</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {otherUpcoming.map((m) => (
                      <TableRow key={m.id} sx={{ opacity: 0.65 }}>
                        <TableCell>{m.week}</TableCell>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {teamName(m.home_team_id)} vs {teamName(m.away_team_id)}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>
                          {m.scheduled_at ? formatDate(m.scheduled_at, true) : 'Date TBC'}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{m.venue || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>
                          {officials.find((o) => o.id === m.referee_id)?.name || '—'}
                        </TableCell>
                        <TableCell>
                          <StatusChip status={m.status} />
                          {m.status === 'finished' && <Typography variant="caption" display="block">{m.report_finalized_at ? 'Finalised' : 'Awaiting report'}</Typography>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            </>}
          </>
        )}
      </GlassCard>
    </div>
  );
}
