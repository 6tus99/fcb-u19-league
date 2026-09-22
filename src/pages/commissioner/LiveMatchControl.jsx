import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

const EVENT_TYPES = [
  { id: 'goal', label: '⚽ Goal' },
  { id: 'yellow_card', label: '🟨 Yellow card' },
  { id: 'red_card', label: '🟥 Red card' },
  { id: 'substitution', label: '🔁 Substitution' },
  { id: 'note', label: '📝 Note' },
];

const EMPTY_FORM = { type: 'goal', minute: '45', teamSide: 'home', playerName: '', description: '' };

export default function LiveMatchControl() {
  const { matchId } = useParams();
  const [options, setOptions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const loadOptions = useCallback(async () => {
    const [m, t] = await Promise.all([
      supabase.from('matches').select('*').in('status', ['scheduled', 'live']),
      supabase.from('teams').select('*'),
    ]);
    setOptions(m.data || []);
    setTeams(t.data || []);
    setLoaded(true);
  }, []);

  const loadMatch = useCallback(async (id) => {
    if (!id) return;
    const [m, ev, pl] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).maybeSingle(),
      supabase.from('match_events').select('*').eq('match_id', id).order('minute', { ascending: true, nullsFirst: false }),
      supabase.from('profiles').select('id, full_name, team_id').eq('role', 'player'),
    ]);
    setMatch(m.data);
    setEvents(ev.data || []);
    setPlayers(pl.data || []);
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  useEffect(() => {
    if (matchId) {
      loadMatch(matchId);
    } else {
      setMatch(null);
    }
  }, [matchId, loadMatch]);

  // Real-time refresh while a match is live
  useEffect(() => {
    if (!match || match.status !== 'live') return undefined;
    const channel = supabase
      .channel(`live-control-${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, () => loadMatch(match.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${match.id}` }, () => loadMatch(match.id))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [match, loadMatch]);

  if (!loaded) return <LoadingSpinner message="Loading live control…" />;

  const teamName = (teamId) => teams.find((t) => t.id === teamId)?.name || 'TBD';
  const homeTeamId = match?.home_team_id;
  const awayTeamId = match?.away_team_id;
  const selectedTeamId = form.teamSide === 'home' ? homeTeamId : awayTeamId;
  const squadOptions = players.filter((p) => p.team_id === selectedTeamId);

  const setMatchStatus = async (status) => {
    const { error } = await supabase.from('matches').update({ status }).eq('id', match.id);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return;
    }
    setMessage({ severity: 'success', text: status === 'live' ? 'Match is LIVE.' : 'Match finished. Result saved.' });
    loadMatch(match.id);
  };

  const addEvent = async (e) => {
    e.preventDefault();
    const isGoal = form.type === 'goal';
    const description =
      form.description || (form.playerName ? `${isGoal ? 'Goal' : form.type.replace('_', ' ')} — ${form.playerName}` : null);
    const payload = {
      match_id: match.id,
      minute: form.minute ? Number(form.minute) : null,
      event_type: form.type,
      team_id: selectedTeamId,
      description,
    };
    if (form.playerName && players.some((p) => p.full_name === form.playerName)) {
      payload.player_id = players.find((p) => p.full_name === form.playerName).id;
    }
    const { error } = await supabase.from('match_events').insert(payload);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return;
    }
    if (isGoal) {
      const col = form.teamSide === 'home' ? 'home_score' : 'away_score';
      const { error: scoreError } = await supabase
        .from('matches')
        .update({ [col]: match[col] + 1 })
        .eq('id', match.id);
      if (scoreError) setMessage({ severity: 'error', text: scoreError.message });
    }
    setMessage({ severity: 'success', text: 'Event recorded.' });
    setForm({ ...EMPTY_FORM, type: form.type, teamSide: form.teamSide });
    loadMatch(match.id);
  };

  // ---------- picker view ----------
  if (!matchId) {
    return (
      <div>
        <PageHeader title="Live Match Control" subtitle="Pick a match to control" />
        {options.length === 0 ? (
          <GlassCard>
            <EmptyState message="No scheduled or live matches found." />
          </GlassCard>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {options
              .sort((a, b) => (a.status === b.status ? new Date(a.scheduled_at) - new Date(b.scheduled_at) : a.status === 'live' ? -1 : 1))
              .map((m) => (
                <Paper
                  key={m.id}
                  sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 2.5, bgcolor: 'rgba(255,255,255,0.03)' }}
                >
                  <Box sx={{ flex: 1, minWidth: 220 }}>
                    <Typography sx={{ fontWeight: 700 }}>
                      {teamName(m.home_team_id)} vs {teamName(m.away_team_id)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Week {m.week} • {formatDate(m.scheduled_at, true)}
                    </Typography>
                  </Box>
                  <StatusChip status={m.status} />
                  <Button
                    component={RouterLink}
                    to={`/commissioner/live/${m.id}`}
                    variant={m.status === 'live' ? 'contained' : 'outlined'}
                    color={m.status === 'live' ? 'error' : 'primary'}
                  >
                    {m.status === 'live' ? 'Continue' : 'Open'}
                  </Button>
                </Paper>
              ))}
          </Box>
        )}
      </div>
    );
  }

  // ---------- control view ----------
  const home = teams.find((t) => t.id === homeTeamId);
  const away = teams.find((t) => t.id === awayTeamId);

  return (
    <div>
      <PageHeader
        title="Live Match Control"
        action={
          <Button component={RouterLink} to="/commissioner/live" variant="text" startIcon={<AddRounded style={{ transform: 'rotate(180deg)' }}/>}>
            All matches
          </Button>
        }
      />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <Paper sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid rgba(255,255,255,0.08)', bgcolor: 'rgba(255,255,255,0.03)', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Typography color="text.secondary">
            Week {match.week} • {formatDate(match.scheduled_at, true)}
            {match.venue ? ` • ${match.venue}` : ''}
          </Typography>
          <StatusChip status={match.status} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1, textAlign: 'right' }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: home ? home.color : 'grey', ml: 'auto', mb: 1 }} />
            <Typography variant="h5">{home ? home.name : 'TBD'}</Typography>
          </Box>
          <Typography variant="h1" sx={{ fontWeight: 900, color: match.status === 'live' ? 'primary.main' : 'inherit' }}>
            {match.home_score} : {match.away_score}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: away ? away.color : 'grey', mb: 1 }} />
            <Typography variant="h5">{away ? away.name : 'TBD'}</Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap' }}>
          {match.status === 'scheduled' && (
            <Button variant="contained" size="large" startIcon={<PlayArrowRounded />} onClick={() => setMatchStatus('live')}>
              Start match
            </Button>
          )}
          {match.status === 'live' && (
            <Button variant="contained" color="error" size="large" startIcon={<StopRounded />} onClick={() => setMatchStatus('finished')}>
              End match
            </Button>
          )}
        </Box>
      </Paper>

      {match.status === 'live' && (
        <GlassCard title="Record event" sx={{ mb: 3 }}>
          <Box component="form" onSubmit={addEvent} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, alignItems: 'end' }}>
            <TextField
              label="Event"
              select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {EVENT_TYPES.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Team"
              select
              value={form.teamSide}
              onChange={(e) => setForm({ ...form, teamSide: e.target.value, playerName: '' })}
            >
              <MenuItem value="home">{home ? home.name : 'Home'}</MenuItem>
              <MenuItem value="away">{away ? away.name : 'Away'}</MenuItem>
            </TextField>
            <TextField
              label="Minute"
              type="number"
              value={form.minute}
              onChange={(e) => setForm({ ...form, minute: e.target.value })}
              inputProps={{ min: 0, max: 120 }}
            />
            <TextField
              label="Player (optional)"
              value={form.playerName}
              onChange={(e) => setForm({ ...form, playerName: e.target.value })}
              helperText={squadOptions.length === 0 ? 'No registered players' : ''}
            />
            <TextField
              label="Description (optional — auto-filled for goals with a player)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' } }}
            />
            <Box sx={{ gridColumn: { xs: '1 / -1', md: '1 / -1' } }}>
              <Button type="submit" variant="contained" startIcon={<AddRounded />}>
                Record {form.type.replace('_', ' ')}
              </Button>
            </Box>
          </Box>
        </GlassCard>
      )}

      <GlassCard title={`Events (${events.length})`}>
        {events.length === 0 ? (
          <EmptyState message="No events recorded yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((ev) => (
              <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ width: 44, fontWeight: 800, color: 'text.secondary' }}>
                  {ev.minute != null ? `${ev.minute}'` : '—'}
                </Typography>
                <Typography>{EVENT_TYPES.find((t) => t.id === ev.event_type)?.label?.slice(0, 2) || '📝'}</Typography>
                {ev.team_id && (
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: teams.find((t) => t.id === ev.team_id)?.color || 'grey' }} />
                )}
                <Typography sx={{ flex: 1 }}>{ev.description || ev.event_type.replace('_', ' ')}</Typography>
                <Button size="small" color="error" sx={{ fontSize: 12 }} onClick={async () => await supabase.from('match_events').delete().eq('id', ev.id).then(() => loadMatch(match.id))}>
                  Delete
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>
    </div>
  );
}
