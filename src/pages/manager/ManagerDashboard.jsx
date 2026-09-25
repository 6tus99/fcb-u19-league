import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { computeStandings, readableTextOn } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

export default function ManagerDashboard() {
  const { profile } = useAuth();
  const [team, setTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [squad, setSquad] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const teamId = profile?.team_id;

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
    ]).then(([t, all, m, sq]) => {
      setTeam(t.data);
      setTeams(all.data || []);
      setMatches(m.data || []);
      setSquad(sq.data || []);
      setLoaded(true);
    });
    return undefined;
  }, [teamId]);

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
          border: '1px solid rgba(255,255,255,0.08)',
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          bgcolor: 'rgba(255,255,255,0.03)',
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
              <strong style={{ color: '#4ade80' }}>{row.Pts} points</strong>
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
              <EmptyState message="No squad members yet. Players can register with your team from the sign-up page." />
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
    </div>
  );
}
