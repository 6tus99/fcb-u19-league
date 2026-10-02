import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import TransferWithinAStationRounded from '@mui/icons-material/TransferWithinAStationRounded';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import SportsScoreRounded from '@mui/icons-material/SportsScoreRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import HandshakeRounded from '@mui/icons-material/HandshakeRounded';
import { alpha } from '@mui/material/styles';
import StatTile from '../../components/StatTile';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/StatusChip';
import { formatDate, readableTextOn } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

const TRANSFERS_SELECT = '*, team:teams!requests_team_id_fkey (id, name)';

export default function PlayerDashboard() {
  const { profile } = useAuth();
  const [team, setTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [squad, setSquad] = useState([]);
  const [myEvents, setMyEvents] = useState([]);
  const [myTransfers, setMyTransfers] = useState([]);
  const [target, setTarget] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const teamId = profile?.team_id;

  const loadTransfers = useCallback(async () => {
    if (!teamId) return;
    const res = await supabase
      .from('requests')
      .select(TRANSFERS_SELECT)
      .eq('player_profile_id', profile.id)
      .eq('type', 'transfer')
      .order('created_at', { ascending: false })
      .limit(10);
    setMyTransfers(res.data || []);
  }, [teamId, profile.id]);

  useEffect(() => {
    if (!teamId) {
      setLoaded(true);
      return undefined;
    }
    Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).maybeSingle(),
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('profiles').select('id, full_name, role').eq('team_id', teamId).in('role', ['player', 'manager']),
      supabase.from('match_events').select('*, match:matches(id, week)').eq('player_id', profile.id).order('minute'),
    ]).then(([t, all, m, sq, ev]) => {
      setTeam(t.data);
      setTeams(all.data || []);
      setMatches(m.data || []);
      setSquad(sq.data || []);
      setMyEvents(ev.data || []);
      setLoaded(true);
    });
    loadTransfers();
    return undefined;
  }, [teamId, profile.id, loadTransfers]);

  if (!loaded) return <LoadingSpinner message="Loading your club…" />;

  if (!teamId || !team) {
    return (
      <div>
        <PageHeader title="My Team" subtitle="Player area" />
        <GlassCard>
          <EmptyState message="You are not assigned to a team yet. Ask your team manager to add you, or ask the league admin to assign you." />
        </GlassCard>
      </div>
    );
  }

  const teamMatches = matches
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const pendingTransfer = myTransfers.find((r) => r.status === 'pending');

  const submitTransfer = async () => {
    if (!target || pendingTransfer) return;
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from('requests').insert({
      type: 'transfer',
      requested_by: profile.id,
      player_profile_id: profile.id,
      from_team_id: teamId,
      team_id: target,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return;
    }
    setMessage({ severity: 'success', text: 'Transfer request sent to the league admin.' });
    setTarget('');
    setNote('');
    loadTransfers();
  };

  return (
    <div>
      <PageHeader title="My Team" subtitle="Your club, squad and fixtures" />

      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3.5,
          border: '1px solid',
          borderColor: 'divider',
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          bgcolor: 'tint',
          backgroundImage: `linear-gradient(120deg, ${alpha(team.primary_color, 0.22)} 0%, rgba(0,0,0,0) 60%)`,
        }}
      >
        <Box sx={{ width: 54, height: 54, borderRadius: '50%', bgcolor: team.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 900, color: readableTextOn(team.primary_color) }}>{team.short_name}</Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">{team.name}</Typography>
          <Typography color="text.secondary">{squad.length} registered squad members</Typography>
        </Box>
      </Paper>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<SportsSoccerRounded sx={{ fontSize: 26 }} />}
            label="Club"
            value={team.short_name}
            sub={team.name}
            tone="blue"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<SportsScoreRounded sx={{ fontSize: 26 }} />}
            label="Team matches played"
            value={teamMatches.filter((m) => m.status === 'finished').length}
            tone="slate"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<EmojiEventsRounded sx={{ fontSize: 26 }} />}
            label="My goals"
            value={myEvents.filter((e) => e.type === 'goal').length}
            tone="green"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<HandshakeRounded sx={{ fontSize: 26 }} />}
            label="My assists"
            value={myEvents.filter((e) => e.type === 'assist').length}
            tone="amber"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard title="Team fixtures & results" sx={{ mb: 3 }}>
            {teamMatches.length === 0 ? (
              <EmptyState message="No matches scheduled yet." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {teamMatches.map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </Box>
            )}
          </GlassCard>

          <GlassCard title="My match events">
            {myEvents.length === 0 ? (
              <EmptyState message="No events recorded against you yet." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {myEvents.map((ev) => (
                  <Box
                    key={ev.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 1,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography sx={{ width: 44, fontWeight: 800, color: 'text.secondary' }}>
                      {ev.minute != null ? `${ev.minute}'` : '—'}
                    </Typography>
                    <RouterLink to={`/matches/${ev.match.id}`} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      Week {ev.match.week}
                    </RouterLink>
                    <Typography sx={{ ml: 'auto' }}>{ev.description}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard title={`Squad (${squad.length})`}>
            {squad.length === 0 ? (
              <EmptyState message="No squad members yet." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {squad.map((p) => (
                  <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                    <Typography sx={{ fontWeight: 600 }}>
                      {p.full_name}
                      {p.id === profile.id ? ' (you)' : ''}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {p.role === 'manager' ? 'Manager' : 'Player'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </GlassCard>

          <GlassCard title="Transfer request" sx={{ mt: 3 }}>
            <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
              Want to play for another club? Send a transfer request — the league admin approves or
              rejects it, and once approved you are moved instantly.
            </Alert>
            {message && (
              <Alert severity={message.severity} sx={{ mb: 1.5 }} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}
            {pendingTransfer ? (
              <Alert severity="warning">
                Your transfer request to <strong>{pendingTransfer.team?.name || '…'}</strong> is
                waiting for the league admin.
              </Alert>
            ) : (
              <>
                <TextField
                  select
                  fullWidth
                  label="Transfer to team"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  sx={{ mb: 1.5 }}
                  inputProps={{ 'aria-label': 'Transfer to team' }}
                >
                  <MenuItem value="">— select a team —</MenuItem>
                  {teams
                    .filter((t) => t.id !== team.id)
                    .map((t) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.name}
                      </MenuItem>
                    ))}
                </TextField>
                <TextField
                  fullWidth
                  label="Reason (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  sx={{ mb: 1.5 }}
                />
                <Button
                  variant="contained"
                  startIcon={<TransferWithinAStationRounded />}
                  onClick={submitTransfer}
                  disabled={busy || !target}
                >
                  Request transfer
                </Button>
              </>
            )}
            {myTransfers.length > 0 && (
              <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 700, textTransform: 'uppercase', fontSize: 11 }}
                >
                  History
                </Typography>
                {myTransfers.map((r) => (
                  <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 600, flexGrow: 1 }}>
                      → {r.team?.name || 'Unknown team'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(r.created_at)}
                    </Typography>
                    <StatusChip status={r.status} />
                  </Box>
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>
      </Grid>
    </div>
  );
}
