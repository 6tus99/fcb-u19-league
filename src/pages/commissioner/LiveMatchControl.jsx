import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
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
  { id: 'half_time', label: '⏸ End of 1st half' },
  { id: 'second_half', label: '▶ 2nd half begins' },
  { id: 'extra_time', label: '➕ Added time' },
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
  const [options, setOptions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [match, setMatch] = useState(null);
  const [events, setEvents] = useState([]);
  const [players, setPlayers] = useState([]);
  const [minute, setMinute] = useState('45');
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [matchErr, setMatchErr] = useState('');
  // Live match clock — ticks once a second while the match is live.
  const [now, setNow] = useState(Date.now());
  const isLive = match?.status === 'live';

  useEffect(() => {
    if (!isLive) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

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

  const setMatchStatus = async (status) => {
    // When the match goes live, record the exact start time — the match
    // clock runs from this moment (so it survives page refreshes).
    const patch = status === 'live' ? { status, live_started_at: new Date().toISOString() } : { status };
    const { error } = await supabase.from('matches').update(patch).eq('id', match.id);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return;
    }
    setMessage({ severity: 'success', text: status === 'live' ? 'Match is LIVE.' : 'Match finished. Result saved.' });
    loadMatch(match.id);
  };

  // Record a team event (goal / foul / substitution / yellow / red)
  // for the given side, with the chosen player's name.
  const recordTeamEvent = async (side, eventType, playerName) => {
    if (!match || recording) return false;
    setRecording(true);
    const player = playerName ? players.find((p) => p.full_name === playerName) : null;
    const payload = {
      match_id: match.id,
      minute: minute ? Number(minute) : null,
      event_type: eventType,
      team_id: side === 'home' ? match.home_team_id : match.away_team_id,
      description: playerName ? `${EVENT_LABEL[eventType] || eventType} — ${playerName}` : null,
    };
    if (player) payload.player_id = player.id;
    const { error } = await supabase.from('match_events').insert(payload);
    setRecording(false);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return false;
    }
    if (eventType === 'goal') {
      const col = side === 'home' ? 'home_score' : 'away_score';
      const { error: scoreError } = await supabase
        .from('matches')
        .update({ [col]: match[col] + 1 })
        .eq('id', match.id);
      if (scoreError) setMessage({ severity: 'error', text: scoreError.message });
    }
    setMessage({ severity: 'success', text: `${EVENT_LABEL[eventType] || eventType} recorded.` });
    loadMatch(match.id);
    return true;
  };

  // Record a match-level phase event (halves, added time).
  const recordPhase = async (eventType) => {
    if (!match || recording) return;
    setRecording(true);
    const { error } = await supabase
      .from('match_events')
      .insert({
        match_id: match.id,
        minute: minute ? Number(minute) : null,
        event_type: eventType,
        team_id: null,
        description: null,
      });
    setRecording(false);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return;
    }
    setMessage({ severity: 'success', text: 'Recorded.' });
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
  if (matchErr) {
    return (
      <div>
        <PageHeader
          title="Live Match Control"
          action={
            <Button component={RouterLink} to="/commissioner/live" variant="text" startIcon={<AddRounded style={{ transform: 'rotate(180deg)' }} />}>
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

  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);

  // Match clock: 1st half counts 0:00 -> 40:00 and AUTO-STOPS; the 2nd
  // half restarts from 0:00 when "2nd half begins" is recorded, and once
  // it passes 40:00 it keeps counting added time (40+0:01, 40+0:02…)
  // automatically — no need to enter added time first.
  let clock = null;
  if (isLive && match.live_started_at) {
    const HALF = HALF_MINUTES * 60 * 1000;
    const liveStart = new Date(match.live_started_at).getTime();
    const shEvent = events.find((e) => e.event_type === 'second_half');
    if (!shEvent) {
      const elapsed = now - liveStart;
      const over = elapsed >= HALF;
      clock = {
        text: fmtClock(Math.min(elapsed, HALF)),
        label: over ? `Half time — clock auto-stopped at ${HALF_MINUTES}:00` : '1st half',
        running: !over,
      };
    } else {
      const elapsed = now - new Date(shEvent.created_at).getTime();
      if (elapsed <= HALF) {
        clock = { text: fmtClock(elapsed), label: '2nd half', running: true };
      } else {
        clock = { text: `40+${fmtClock(elapsed - HALF)}`, label: 'Added time — counting automatically', running: true };
      }
    }
  }

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

      <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'cardBorder', bgcolor: 'tint', mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Week {match.week} • {formatDate(match.scheduled_at, true)}
            {match.venue ? ` • ${match.venue}` : ''}
          </Typography>
          <StatusChip status={match.status} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1, textAlign: 'right' }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: home ? home.primary_color : 'grey', ml: 'auto', mb: 1 }} />
            <Typography variant="h5">{home ? home.name : 'TBD'}</Typography>
          </Box>
          <Typography variant="h1" sx={{ fontWeight: 900, color: match.status === 'live' ? 'primary.main' : 'inherit' }}>
            {match.home_score} : {match.away_score}
          </Typography>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: away ? away.primary_color : 'grey', mb: 1 }} />
            <Typography variant="h5">{away ? away.name : 'TBD'}</Typography>
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

        {/* Event recording — inside the same container */}
        {match.status === 'live' && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
              <TextField
                label="Minute"
                type="number"
                size="small"
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
                inputProps={{ min: 0, max: 120 }}
                sx={{ width: 92 }}
              />
              {PHASE_BUTTONS.map((b) => (
                <Button
                  key={b.id}
                  size="small"
                  variant="outlined"
                  disabled={recording}
                  onClick={() => recordPhase(b.id)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {b.label}
                </Button>
              ))}
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.5 }}>
              <TeamEventPanel
                team={home}
                players={players}
                recording={recording}
                onRecord={(eventType, playerName) => recordTeamEvent('home', eventType, playerName)}
              />
              <TeamEventPanel
                team={away}
                players={players}
                recording={recording}
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
              <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'cardBorder' }}>
                <Typography sx={{ width: 44, fontWeight: 800, color: 'text.secondary' }}>
                  {ev.minute != null ? `${ev.minute}'` : '—'}
                </Typography>
                <Typography>{EVENT_TYPES.find((t) => t.id === ev.event_type)?.label?.slice(0, 2) || '📝'}</Typography>
                {ev.team_id && (
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: teams.find((t) => t.id === ev.team_id)?.primary_color || 'grey' }} />
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

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(84px, 1fr))', gap: 0.75 }}>
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
            sx={{ textTransform: 'none', fontWeight: 700, height: 38, fontSize: 13 }}
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
