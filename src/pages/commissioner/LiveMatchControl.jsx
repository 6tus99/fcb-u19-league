import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const EVENT_TYPES = [
  { id: 'goal', label: '⚽ Goal' },
  { id: 'foul', label: '🚩 Foul' },
  { id: 'yellow_card', label: '🟨 Yellow card' },
  { id: 'red_card', label: '🟥 Red card' },
  { id: 'substitution', label: '🔁 Substitution' },
  { id: 'half_time', label: '⏸ End of first half' },
  { id: 'second_half', label: '▶ Second half begins' },
  { id: 'extra_time', label: '➕ Added time' },
  { id: 'note', label: '📝 Note' },
];

// The 5 action buttons each team gets on the live control panel
const TEAM_BUTTONS = [
  { id: 'goal', emoji: '⚽', label: 'Goal' },
  { id: 'foul', emoji: '🚩', label: 'Foul' },
  { id: 'substitution', emoji: '🔁', label: 'Substitution' },
  { id: 'yellow_card', emoji: '🟨', label: 'Yellow card' },
  { id: 'red_card', emoji: '🟥', label: 'Red card' },
];

const PHASE_BUTTONS = [
  { id: 'half_time', label: 'End of 1st half', color: 'info', Icon: PauseRounded },
  { id: 'second_half', label: '2nd half begins', color: 'success', Icon: PlayArrowRounded },
  { id: 'extra_time', label: 'Added time', color: 'warning', Icon: AddRounded },
];

const EVENT_LABEL = {
  goal: 'Goal',
  foul: 'Foul',
  yellow_card: 'Yellow card',
  red_card: 'Red card',
  substitution: 'Substitution',
};

// Half length for the automatic match clock
const HALF_MINUTES = 40;

const fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function LiveMatchControl() {
  const { matchId } = useParams();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [options, setOptions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [minute, setMinute] = useState('0');
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [matchErr, setMatchErr] = useState('');
  const [commissioners, setCommissioners] = useState([]);
  const [editEvent, setEditEvent] = useState(null);
  const [cancelEvent, setCancelEvent] = useState(null);
  const [reason, setReason] = useState('');
  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [reportAction, setReportAction] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [schemaReady, setSchemaReady] = useState(false);
  // Live match clock — ticks once a second while the match is live.
  const [now, setNow] = useState(Date.now());
  const isLive = match?.status === 'live';

  useEffect(() => {
    if (!isLive) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  const loadOptions = useCallback(async () => {
    const [m, t, c] = await Promise.all([
      supabase.from('matches').select('*').in('status', ['scheduled', 'live', 'finished']),
      supabase.from('teams').select('*'),
      supabase.from('profiles').select('id, full_name').eq('role', 'commissioner'),
    ]);
    setOptions(m.data || []);
    setTeams(t.data || []);
    setCommissioners(c.data || []);
    setLoaded(true);
  }, []);

  const loadMatch = useCallback(async (id) => {
    if (!id) return;
    setMatchErr('');
    const [m, ev, pl] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).maybeSingle(),
      supabase.from('match_events').select('*').eq('match_id', id).order('minute', { ascending: true, nullsFirst: false }),
      supabase.from('profiles').select('id, full_name, team_id').eq('role', 'player'),
    ]);
    if (m.error) {
      setMatch(null);
      setMatchErr(m.error.message);
      return;
    }
    if (!m.data) {
      setMatch(null);
      setMatchErr('Match not found — it may have been deleted.');
      return;
    }
    setMatch(m.data);
    setEvents(ev.data || []);
    setSchemaReady(Object.prototype.hasOwnProperty.call(m.data, 'report_finalized_at'));
    if (Object.prototype.hasOwnProperty.call(m.data, 'report_finalized_at')) {
      const h = await supabase.from('match_correction_history').select('*').eq('match_id', id).order('created_at', { ascending: false });
      setHistory(h.data || []);
    }
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

  const refreshCurrent = useCallback(() => {
    if (matchId) loadMatch(matchId);
  }, [matchId, loadMatch]);
  useAutoRefresh(refreshCurrent, 15000);

  // Real-time refresh including corrections after full time
  useEffect(() => {
    if (!match) return undefined;
    const channel = supabase
      .channel(`live-control-${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, () => loadMatch(match.id))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${match.id}` }, () => loadMatch(match.id))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [match, loadMatch]);

  // Match clock: 1st half counts 0:00 -> 40:00 and AUTO-STOPS; the 2nd
  // half restarts from 0:00 when "2nd half begins" is recorded, and once
  // it passes 40:00 it keeps counting added time (40+0:01, 40+0:02…)
  // automatically. Halves are FIXED at 40 minutes — not editable anywhere.
  // Computed before the early returns so the minute field can auto-fill.
  let clock = null;
  let autoMinute = null;
  if (match && match.status === 'live' && match.live_started_at) {
    const HALF = HALF_MINUTES * 60 * 1000;
    const liveStart = new Date(match.live_started_at).getTime();
    const shEvent = events.find((e) => !e.cancelled_at && e.event_type === 'second_half');
    if (!shEvent) {
      const elapsed = now - liveStart;
      const over = elapsed >= HALF;
      clock = {
        text: fmtClock(Math.min(elapsed, HALF)),
        label: over ? `Half time — clock auto-stopped at ${HALF_MINUTES}:00` : '1st half',
        running: !over,
      };
      autoMinute = Math.min(HALF_MINUTES, Math.floor(elapsed / 60000));
    } else {
      const elapsed = now - new Date(shEvent.created_at).getTime();
      if (elapsed <= HALF) {
        clock = { text: fmtClock(elapsed), label: '2nd half', running: true };
      } else {
        clock = { text: `40+${fmtClock(elapsed - HALF)}`, label: 'Added time — counting automatically', running: true };
      }
      autoMinute = HALF_MINUTES + Math.floor(elapsed / 60000);
    }
  }

  // The event minute auto-fills from the running clock — no typing needed.
  useEffect(() => {
    if (autoMinute != null) setMinute(String(autoMinute));
  }, [autoMinute]);

  if (!loaded) return <LoadingSpinner message="Loading live control…" />;

  const teamName = (teamId) => teams.find((t) => t.id === teamId)?.name || 'TBD';
  const commName = (id) => commissioners.find((c) => c.id === id)?.full_name || 'Another commissioner';

  const setMatchStatus = async (status) => {
    // When the match goes live, record the exact start time — the match
    // clock runs from this moment (so it survives page refreshes).
    if (recording) return;
    setRecording(true);
    const patch = status === 'live' ? { status, live_started_at: new Date().toISOString() } : { status };
    const { data, error } = await supabase.from('matches').update(patch).eq('id', match.id).select('id').maybeSingle();
    setRecording(false);
    setConfirmEnd(false);
    if (error || !data) {
      setMessage({ severity: 'error', text: error?.message || 'This match could not be updated. Your assignment may have changed.' });
      return;
    }
    setMessage({ severity: 'success', text: status === 'live' ? 'Match is LIVE.' : 'Full time saved. Review the events, then submit and finalise the report.' });
    loadMatch(match.id);
  };

  const runEventAction = async (args, success) => {
    if (recording) return false;
    if (!schemaReady) {
      setMessage({ severity: 'warning', text: 'Database setup required: run migration-event-corrections.sql in Supabase first.' });
      return false;
    }
    setRecording(true);
    const { error } = await supabase.rpc('save_match_event', { p_match_id: match.id, ...args });
    setRecording(false);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return false;
    }
    setMessage({ severity: 'success', text: success });
    await loadMatch(match.id);
    return true;
  };

  const recordTeamEvent = async (side, eventType, playerName) => {
    const teamId = side === 'home' ? match.home_team_id : match.away_team_id;
    const player = players.find((p) => p.full_name === playerName && p.team_id === teamId);
    return runEventAction({
      p_action: 'record', p_event_type: eventType, p_team_id: teamId,
      p_player_id: player?.id || null, p_minute: Number(minute),
      p_description: `${EVENT_LABEL[eventType] || eventType} — ${playerName}`,
    }, `${EVENT_LABEL[eventType] || eventType} recorded.`);
  };

  const recordPhase = (eventType) => runEventAction({
    p_action: 'record', p_event_type: eventType, p_minute: Number(minute),
  }, 'Match phase recorded.');

  const changeReport = async () => {
    if (recording) return;
    setRecording(true);
    const { error } = await supabase.rpc('manage_match_report', {
      p_match_id: match.id, p_action: reportAction, p_reason: reason || null,
    });
    setRecording(false);
    if (error) return setMessage({ severity: 'error', text: error.message });
    setReportAction(null);
    setMessage({ severity: 'success', text: reportAction === 'finalise' ? 'Report submitted and finalised. Records are now locked.' : 'Report reopened. The assigned commissioner can correct events.' });
    loadMatch(match.id);
  };

  // ---------- picker view ----------
  if (!matchId) {
    // A commissioner only sees the matches they are assigned to officiate;
    // the league admin sees everything (and can always take over control).
    const list = isAdmin ? options : options.filter((m) => m.commissioner_id === profile?.id);
    return (
      <div>
        <PageHeader title="Live Match Control" subtitle="Pick a match to control" />
        {list.length === 0 ? (
          <GlassCard>
            <EmptyState
              message={isAdmin ? 'No scheduled or live matches found.' : "The league admin hasn't assigned you to any matches yet."}
            />
          </GlassCard>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {list
              .sort((a, b) => (a.status === b.status ? new Date(a.scheduled_at) - new Date(b.scheduled_at) : a.status === 'live' ? -1 : 1))
              .map((m) => (
                <Paper
                  key={m.id}
                  sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', border: '1px solid', borderColor: 'cardBorder', borderRadius: 2.5, bgcolor: 'tint' }}
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
                  <Box sx={{ textAlign: 'right' }}>
                    {isAdmin && m.commissioner_id && (
                      <Typography variant="caption" color="text.secondary">
                        Officiating: {commName(m.commissioner_id)}
                      </Typography>
                    )}
                    <Button
                      component={RouterLink}
                      to={`/commissioner/match-center/live/${m.id}`}
                      variant={m.status === 'live' ? 'contained' : 'outlined'}
                      color={m.status === 'live' ? 'error' : 'primary'}
                    >
                      {m.status === 'live' ? 'Continue' : 'Open'}
                    </Button>
                  </Box>
                </Paper>
              ))}
          </Box>
        )}
      </div>
    );
  }

  // ---------- control view ----------
  if (matchErr) {
    return (
      <div>
        <PageHeader
          title="Live Match Control"
          action={
            <Button component={RouterLink} to="/commissioner/match-center/live" variant="text" startIcon={<AddRounded style={{ transform: 'rotate(180deg)' }} />}>
              All matches
            </Button>
          }
        />
        <Alert severity="error" sx={{ mb: 2 }}>
          {matchErr}
        </Alert>
      </div>
    );
  }

  // The match data may still be loading — never render the detail card
  // with an empty match (that used to crash the page to a blank screen).
  if (!match) return <LoadingSpinner message="Loading match…" />;

  // Only the assigned commissioner may officiate a match.
  if (!isAdmin && match.commissioner_id !== profile?.id) {
    return (
      <div>
        <PageHeader
          title="Live Match Control"
          action={
            <Button component={RouterLink} to="/commissioner/match-center/live" variant="text" startIcon={<AddRounded style={{ transform: 'rotate(180deg)' }} />}>
              All matches
            </Button>
          }
        />
        <Alert severity="warning" sx={{ mb: 2 }}>
          You are not assigned to officiate this match. {commName(match.commissioner_id)} is the assigned commissioner.
        </Alert>
      </div>
    );
  }

  const canCorrect = schemaReady && !match.report_finalized_at && ['live', 'finished'].includes(match.status);
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);

  return (
    <div>
      <PageHeader
        title="Live Match Control"
        action={
          <Button component={RouterLink} to="/commissioner/match-center/live" variant="text" startIcon={<AddRounded style={{ transform: 'rotate(180deg)' }}/>}>
            All matches
          </Button>
        }
      />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {!schemaReady && <Alert severity="warning" sx={{ mb: 2 }}>Database setup required: run migration-event-corrections.sql to enable safe event recording and corrections.</Alert>}
      {match.status === 'finished' && schemaReady && (
        <Alert severity={match.report_finalized_at ? 'success' : 'info'} sx={{ mb: 2 }}>
          {match.report_finalized_at ? 'Report finalised — match records are locked.' : 'Full time — review and correct events before submitting your report.'}
          <Box sx={{ mt: 1 }}>
            {!match.report_finalized_at && <Button variant="contained" onClick={() => { setReason(''); setReportAction('finalise'); }}>Submit &amp; finalise report</Button>}
            {match.report_finalized_at && isAdmin && <Button onClick={() => { setReason(''); setReportAction('reopen'); }}>Reopen report for corrections</Button>}
          </Box>
        </Alert>
      )}

      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'cardBorder', bgcolor: 'tint', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Week {match.week} • {formatDate(match.scheduled_at, true)}
            {match.venue ? ` • ${match.venue}` : ''}
          </Typography>
          <StatusChip status={match.status} />
        </Box>

        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: { xs: 0.5, sm: 2 } }}>
          <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'right' } }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: home ? home.primary_color : 'grey', ml: 'auto', mr: { xs: 'auto', sm: 0 }, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontSize: { xs: 20, sm: 24 } }}>{home ? home.name : 'TBD'}</Typography>
          </Box>
          <Typography variant="h1" sx={{ fontWeight: 900, fontSize: { xs: 44, sm: 72 }, color: match.status === 'live' ? 'primary.main' : 'inherit' }}>
            {match.home_score} : {match.away_score}
          </Typography>
          <Box sx={{ flex: 1, textAlign: { xs: 'center', sm: 'left' } }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: away ? away.primary_color : 'grey', ml: { xs: 'auto', sm: 0 }, mr: { xs: 'auto', sm: 'auto' }, mb: 0.5 }} />
            <Typography variant="h5" sx={{ fontSize: { xs: 20, sm: 24 } }}>{away ? away.name : 'TBD'}</Typography>
          </Box>
        </Box>

        {clock && (
          <Box sx={{ textAlign: 'center', mt: 1.5 }}>
            <Typography
              variant="h3"
              sx={{
                fontWeight: 900,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: 1,
                lineHeight: 1.1,
                color: clock.running ? 'primary.main' : 'text.secondary',
              }}
            >
              {clock.text}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>
              {clock.label}
            </Typography>
          </Box>
        )}
        {isLive && !match.live_started_at && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 1.5 }}>
            Clock starts with the match (run the live-clock SQL to enable it).
          </Typography>
        )}

        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1.5, mt: 2, flexWrap: 'wrap' }}>
          {match.status === 'scheduled' && (
            <Button variant="contained" size="large" startIcon={<PlayArrowRounded />} disabled={recording || !schemaReady} onClick={() => setMatchStatus('live')}>
              Start match
            </Button>
          )}
          {isLive && (
            <Button variant="contained" color="error" size="large" startIcon={<StopRounded />} disabled={recording || !schemaReady} onClick={() => setConfirmEnd(true)} sx={{ fontWeight: 800 }}>
              End match
            </Button>
          )}
        </Box>

        {/* Event recording — inside the same container */}
        {(match.status === 'live' || canCorrect) && !match.report_finalized_at && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1.5 }}>
              <TextField
                label={isLive ? 'Minute (auto)' : 'Event minute'}
                type="number"
                size="medium"
                variant="filled"
                value={minute}
                onChange={(e) => !isLive && setMinute(e.target.value)}
                inputProps={{ min: 0, max: 300, readOnly: isLive, style: { textAlign: 'center' } }}
                sx={{
                  width: 130,
                  '& .MuiFilledInput-root': { borderRadius: 2, fontWeight: 700, fontSize: 16 },
                  '& .MuiInputLabel-root': { fontWeight: 600 },
                }}
              />
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
              {isLive && PHASE_BUTTONS.map((b) => (
                <Button
                  key={b.id}
                  variant="contained"
                  color={b.color}
                  size="medium"
                  disabled={recording || !schemaReady}
                  startIcon={<b.Icon fontSize="small" />}
                  onClick={() => recordPhase(b.id)}
                  sx={{ fontWeight: 700 }}
                >
                  {b.label}
                </Button>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
              <TeamEventPanel
                team={home}
                players={players}
                recording={recording || !schemaReady}
                onRecord={(eventType, playerName) => recordTeamEvent('home', eventType, playerName)}
              />
              <TeamEventPanel
                team={away}
                players={players}
                recording={recording || !schemaReady}
                onRecord={(eventType, playerName) => recordTeamEvent('away', eventType, playerName)}
              />
            </Box>
          </>
        )}
      </Paper>

      <GlassCard title={`Events (${events.length})`}>
        {events.length === 0 ? (
          <EmptyState message="No events recorded yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((ev) => (
              <Box key={ev.id} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1, py: 1, opacity: ev.cancelled_at ? 0.6 : 1, borderBottom: '1px solid', borderColor: 'cardBorder' }}>
                <Typography sx={{ width: 44, fontWeight: 800, color: 'text.secondary' }}>
                  {ev.minute != null ? `${ev.minute}'` : '—'}
                </Typography>
                <Typography>{EVENT_TYPES.find((t) => t.id === ev.event_type)?.label?.slice(0, 2) || '📝'}</Typography>
                {ev.team_id && (
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: teams.find((t) => t.id === ev.team_id)?.primary_color || 'grey' }} />
                )}
                <Box sx={{ flex: 1, minWidth: 120 }}>
                  <Typography sx={{ textDecoration: ev.cancelled_at ? 'line-through' : 'none' }}>{ev.description || ev.event_type.replace('_', ' ')}</Typography>
                  {ev.cancelled_at && <Typography variant="caption" color="error">Cancelled: {ev.cancellation_reason}</Typography>}
                </Box>
                {canCorrect && !ev.cancelled_at && <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button size="small" disabled={recording} onClick={() => { setEditEvent({ ...ev }); setReason(''); }}>Edit</Button>
                  <Button size="small" color="error" disabled={recording} onClick={() => { setCancelEvent(ev); setReason(''); }}>Cancel event</Button>
                </Box>}
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>

      <Dialog open={Boolean(editEvent)} onClose={() => !recording && setEditEvent(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Edit event</DialogTitle>
        <DialogContent>
          {editEvent && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Minute"
                type="number"
                value={editEvent.minute ?? ''}
                onChange={(e) => setEditEvent({ ...editEvent, minute: e.target.value === '' ? null : Number(e.target.value) })}
                inputProps={{ min: 0, max: 300 }}
              />
              <TextField
                label="Type"
                select
                value={editEvent.event_type}
                onChange={(e) => setEditEvent({ ...editEvent, event_type: e.target.value })}
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
                value={editEvent.team_id || ''}
                onChange={(e) => setEditEvent({ ...editEvent, team_id: e.target.value || null, player_id: null, description: '' })}
              >
                <MenuItem value="">No team</MenuItem>
                {teams.filter((t) => [match.home_team_id, match.away_team_id].includes(t.id)).map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField label="Player (registered)" select value={editEvent.player_id || ''}
                onChange={(e) => {
                  const player = players.find((p) => p.id === e.target.value);
                  setEditEvent({ ...editEvent, player_id: player?.id || null,
                    description: player ? `${EVENT_LABEL[editEvent.event_type] || editEvent.event_type} — ${player.full_name}` : '' });
                }}>
                <MenuItem value="">No registered player / enter name below</MenuItem>
                {players.filter((p) => p.team_id === editEvent.team_id).map((p) => <MenuItem key={p.id} value={p.id}>{p.full_name}</MenuItem>)}
              </TextField>
              <TextField
                label="Event description / unregistered player"
                value={editEvent.description || ''}
                onChange={(e) => setEditEvent({ ...editEvent, description: e.target.value })}
                helperText="For a registered player, use the player selector so their statistics update too."
              />
              <TextField label="Reason for correction" required value={reason} onChange={(e) => setReason(e.target.value)} multiline minRows={2} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={recording} onClick={() => setEditEvent(null)}>Back</Button>
          <Button
            variant="contained"
            disabled={recording || reason.trim().length < 3}
            onClick={async () => {
              const ok = await runEventAction({
                p_action: 'edit', p_event_id: editEvent.id, p_revision: editEvent.revision,
                p_event_type: editEvent.event_type, p_team_id: editEvent.team_id,
                p_player_id: editEvent.player_id || null, p_minute: editEvent.minute,
                p_description: editEvent.description || null, p_reason: reason.trim(),
              }, 'Event corrected. Score and player statistics updated.');
              if (ok) setEditEvent(null);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(cancelEvent)} onClose={() => !recording && setCancelEvent(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel this event?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{cancelEvent?.description || cancelEvent?.event_type?.replace('_', ' ')}</Typography>
          <Alert severity="warning" sx={{ mb: 2 }}>Cancelling a goal subtracts it from the score and player tally. The original event stays in the correction history.</Alert>
          <TextField fullWidth required multiline minRows={2} label="Reason for cancellation" value={reason} onChange={(e) => setReason(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button disabled={recording} onClick={() => setCancelEvent(null)}>Keep event</Button>
          <Button color="error" variant="contained" disabled={recording || reason.trim().length < 3} onClick={async () => {
            const ok = await runEventAction({ p_action: 'cancel', p_event_id: cancelEvent.id, p_revision: cancelEvent.revision, p_reason: reason.trim() }, 'Event cancelled. Score and player statistics updated.');
            if (ok) setCancelEvent(null);
          }}>Confirm cancellation</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirmEnd} onClose={() => !recording && setConfirmEnd(false)} maxWidth="xs" fullWidth>
        <DialogTitle>End match?</DialogTitle>
        <DialogContent>Save full time at {match.home_score}–{match.away_score}? You can still correct events before finalising the report.</DialogContent>
        <DialogActions><Button disabled={recording} onClick={() => setConfirmEnd(false)}>Keep playing</Button><Button color="error" variant="contained" disabled={recording} onClick={() => setMatchStatus('finished')}>Confirm full time</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(reportAction)} onClose={() => !recording && setReportAction(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{reportAction === 'reopen' ? 'Reopen match report?' : 'Submit & finalise report?'}</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>{reportAction === 'reopen' ? 'The assigned commissioner will be able to correct events again. This action is recorded.' : 'Confirm you have checked the score, players and all events. Further corrections will require an admin to reopen this report.'}</Typography>
          {reportAction === 'reopen' && <TextField fullWidth required label="Reason for reopening" value={reason} onChange={(e) => setReason(e.target.value)} />}
        </DialogContent>
        <DialogActions><Button disabled={recording} onClick={() => setReportAction(null)}>Back</Button><Button variant="contained" disabled={recording || (reportAction === 'reopen' && reason.trim().length < 3)} onClick={changeReport}>Confirm</Button></DialogActions>
      </Dialog>

      {schemaReady && <Box sx={{ mt: 2 }}>
        <Button onClick={() => setHistoryOpen(!historyOpen)}>{historyOpen ? 'Hide' : 'Show'} correction history ({history.length})</Button>
        {historyOpen && <GlassCard title="Audit trail">
          {history.length === 0 && <Typography>No corrections recorded yet. Older events predate this audit trail.</Typography>}
          {history.map((h) => <Box key={h.id} sx={{ py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Typography sx={{ fontWeight: 700 }}>{h.action} — {h.actor_name}</Typography>
            <Typography variant="caption">{formatDate(h.created_at, true)}</Typography>
            <Typography variant="body2">{h.reason}</Typography>
            {h.before_data?.event_type && <Typography variant="body2">Before: {h.before_data.minute ?? '—'}′ {h.before_data.event_type} · {h.before_data.description || 'No description'} · {teamName(h.before_data.team_id)}</Typography>}
            {h.after_data?.event_type && <Typography variant="body2">After: {h.after_data.cancelled_at ? 'CANCELLED · ' : ''}{h.after_data.minute ?? '—'}′ {h.after_data.event_type} · {h.after_data.description || 'No description'} · {teamName(h.after_data.team_id)}</Typography>}
          </Box>)}
        </GlassCard>}
      </Box>}

    </div>
  );
}

// One team's control panel: five action buttons. Tapping a button pops
// out that team's registered players to pick from (or a free-text name
// field if the team has no registered players yet).
function TeamEventPanel({ team, players, recording, onRecord }) {
  const [openBtn, setOpenBtn] = useState(null);
  const [manualName, setManualName] = useState('');
  const squad = players.filter((p) => p.team_id === team?.id);

  const pick = async (eventType, playerName) => {
    if (!playerName?.trim()) return;
    const ok = await onRecord(eventType, playerName.trim());
    if (ok) {
      setOpenBtn(null);
      setManualName('');
    }
  };

  const active = TEAM_BUTTONS.find((b) => b.id === openBtn);

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'cardBorder',
        borderRadius: 2,
        p: 1,
        bgcolor: 'background.paper',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: team?.primary_color || 'grey', flexShrink: 0 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
          {team?.name || 'TBD'}
        </Typography>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 0.75 }}>
        {TEAM_BUTTONS.map((b) => (
          <Button
            key={b.id}
            variant={openBtn === b.id ? 'contained' : 'outlined'}
            size="small"
            disabled={recording}
            onClick={() => {
              setOpenBtn(openBtn === b.id ? null : b.id);
              setManualName('');
            }}
            sx={{ fontWeight: 700, height: 40, fontSize: 12.5 }}
          >
            {b.emoji} {b.label}
          </Button>
        ))}
      </Box>

      {openBtn && active && (
        <Box sx={{ mt: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {active.emoji} {active.label} — select the player
          </Typography>
          {squad.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {squad.map((p) => (
                <Button
                  key={p.id}
                  fullWidth
                  size="small"
                  disabled={recording}
                  onClick={() => pick(openBtn, p.full_name)}
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  {p.full_name}
                </Button>
              ))}
            </Box>
          ) : (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                No registered players for this team — type the name
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Player name"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      pick(openBtn, manualName);
                    }
                  }}
                />
                <Button size="small" variant="contained" disabled={recording || !manualName.trim()} onClick={() => pick(openBtn, manualName)}>
                  Record
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
