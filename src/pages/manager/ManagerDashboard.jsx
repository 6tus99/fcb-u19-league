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
import PersonAddAlt1Rounded from '@mui/icons-material/PersonAddAlt1Rounded';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/StatusChip';
import { computeStandings, formatDate, readableTextOn } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

const REQUESTS_SELECT =
  '*, player:profiles!requests_player_profile_id_fkey (id, full_name, email)';

export default function ManagerDashboard() {
  const { profile } = useAuth();
  const [team, setTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [squad, setSquad] = useState([]);
  const [available, setAvailable] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selected, setSelected] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const teamId = profile?.team_id;

  const loadRequests = useCallback(async () => {
    if (!teamId) return;
    const rq = await supabase
      .from('requests')
      .select(REQUESTS_SELECT)
      .eq('team_id', teamId)
      .eq('type', 'add_player')
      .order('created_at', { ascending: false })
      .limit(15);
    setRequests(rq.data || []);
  }, [teamId]);

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
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .in('role', ['player', 'fan'])
        .is('team_id', null)
        .order('full_name'),
    ]).then(([t, all, m, sq, av]) => {
      setTeam(t.data);
      setTeams(all.data || []);
      setMatches(m.data || []);
      setSquad(sq.data || []);
      setAvailable((av.data || []).filter((p) => p.id !== profile.id));
      setLoaded(true);
    });
    loadRequests();
    return undefined;
  }, [teamId, profile.id, loadRequests]);

  if (!loaded) return <LoadingSpinner message="Loading your club…" />;

  if (!teamId || !team) {
    return (
      <div>
        <PageHeader title="My Team" subtitle="Manager area" />
        <GlassCard>
          <EmptyState message="You are not assigned to a team yet. Ask your league admin to assign you." />
        </GlassCard>
      </div>
    );
  }

  // players who already have a pending add-request for this team are hidden
  // from the dropdown (and blocked at the database level as well)
  const pendingPlayerIds = new Set(
    requests.filter((r) => r.status === 'pending').map((r) => r.player_profile_id)
  );
  const openPlayers = available.filter((p) => !pendingPlayerIds.has(p.id));

  const submitAdd = async () => {
    if (!selected) return;
    if (pendingPlayerIds.has(selected)) {
      setMessage({ severity: 'warning', text: 'A pending request already exists for this player.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const { error } = await supabase.from('requests').insert({
      type: 'add_player',
      requested_by: profile.id,
      team_id: teamId,
      player_profile_id: selected,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
      return;
    }
    setMessage({ severity: 'success', text: 'Request sent to the league admin.' });
    setSelected('');
    setNote('');
    loadRequests();
  };

  const teamMatches = matches
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const row = computeStandings(matches, teams).find((r) => r.team.id === team.id);

  return (
    <div>
      <PageHeader title="My Team" subtitle="Manager dashboard" />

      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          bgcolor: 'tint',
        }}
      >
        <Box sx={{ width: 54, height: 54, borderRadius: '50%', bgcolor: team.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Typography sx={{ fontWeight: 900, color: readableTextOn(team.primary_color) }}>{team.short_name}</Typography>
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">{team.name}</Typography>
          {row && (
            <Typography color="text.secondary">
              {row.P} played • {row.W}–{row.D}–{row.L} • {row.GF}–{row.GA} goals •{' '}
              <Typography component="span" sx={{ color: 'primary.main', fontWeight: 800 }}>{row.Pts} points</Typography>
            </Typography>
          )}
        </Box>
        {row && (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h3" sx={{ fontWeight: 900, color: 'primary.main' }}>
              #{teams.length ? computeStandings(matches, teams).findIndex((r) => r.team.id === team.id) + 1 : '—'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              in the table
            </Typography>
          </Box>
        )}
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard title="Fixtures & results">
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
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard title={`Squad (${squad.length})`}>
            {squad.length === 0 ? (
              <EmptyState message="No squad members yet. Use “Add a player” below to send a request." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {squad.map((p) => (
                  <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.25 }}>
                    <Typography sx={{ fontWeight: 600 }}>{p.full_name}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                      {p.role === 'manager' ? 'Manager' : 'Player'}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </GlassCard>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Player events (goals, cards) can be recorded by the commissioner during live match control.{' '}
            <RouterLink to="/standings" style={{ fontWeight: 700 }}>
              View standings →
            </RouterLink>
          </Typography>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 0 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard title="Add a player">
            <Alert severity="info" sx={{ mb: 2, fontSize: 13 }}>
              The player needs a registered account on this website first. Pick them below — the
              league admin approves or rejects the request, and once approved they appear in your
              squad.
            </Alert>
            {message && (
              <Alert severity={message.severity} sx={{ mb: 1.5 }} onClose={() => setMessage(null)}>
                {message.text}
              </Alert>
            )}
            {openPlayers.length === 0 ? (
              <EmptyState message="No registered players without a team right now. Players with a pending request are hidden from this list — check “Squad requests”." />
            ) : (
              <>
                <TextField
                  select
                  fullWidth
                  label="Registered player (no team yet)"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  sx={{ mb: 1.5 }}
                  inputProps={{ 'aria-label': 'Player to add' }}
                >
                  <MenuItem value="">— select a player —</MenuItem>
                  {openPlayers.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.full_name} ({p.email})
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  fullWidth
                  label="Note for the admin (optional)"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  sx={{ mb: 1.5 }}
                />
                <Button
                  variant="contained"
                  startIcon={<PersonAddAlt1Rounded />}
                  onClick={submitAdd}
                  disabled={busy || !selected}
                >
                  Send request to admin
                </Button>
              </>
            )}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard title="Squad requests">
            {requests.length === 0 ? (
              <EmptyState message="No requests yet. When you add a player, the request appears here until the admin responds." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {requests.map((r) => (
                  <Box
                    key={r.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      py: 0.75,
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Box sx={{ flexGrow: 1, minWidth: 140 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {r.player?.full_name || 'Unknown player'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(r.created_at)}
                        {r.note ? ` • ${r.note}` : ''}
                      </Typography>
                    </Box>
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
