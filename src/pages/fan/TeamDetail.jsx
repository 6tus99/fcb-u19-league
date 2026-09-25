import React, { useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { computeStandings, readableTextOn } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function TeamDetail() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [squad, setSquad] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('*').eq('id', id).maybeSingle(),
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*'),
      supabase.from('profiles').select('id, full_name, role').eq('team_id', id).in('role', ['player', 'manager']),
    ]).then(([t, all, m, sq]) => {
      setTeam(t.data);
      setTeams(all.data || []);
      setMatches(m.data || []);
      setSquad(sq.data || []);
      setLoaded(true);
    });
  }, [id]);

  if (!loaded) return <LoadingSpinner message="Loading team…" />;
  if (!team) return <EmptyState message="Team not found." />;

  const teamMatches = matches
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const row = computeStandings(matches, teams).find((r) => r.team.id === team.id);

  return (
    <div>
      <Link component={RouterLink} to="/teams" variant="body2" sx={{ fontWeight: 600 }}>
        ← All teams
      </Link>

      <Paper
        sx={{
          mt: 1.5,
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(255,255,255,0.03)',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ width: 54, height: 54, borderRadius: '50%', bgcolor: team.primary_color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Typography sx={{ fontWeight: 900, color: readableTextOn(team.primary_color) }}>{team.short_name}</Typography>
          </Box>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h4">{team.name}</Typography>
            <Typography color="text.secondary" variant="body2">
              {team.city}
              {team.stadium ? ` • ${team.stadium}` : ''}
            </Typography>
            {row && (
              <Typography color="text.secondary">
                {row.P} played • {row.W} wins • {row.D} draws • {row.L} losses • {row.GF}–{row.GA} goals •{' '}
                <strong style={{ color: '#4ade80' }}>{row.Pts} points</strong>
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <GlassCard title="Fixtures & results" sx={{ mb: 3 }}>
            {teamMatches.length === 0 ? (
              <EmptyState message="No matches for this team yet." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {teamMatches.map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <GlassCard title={`Squad (${squad.length})`}>
            {squad.length === 0 ? (
              <EmptyState message="No players registered yet." />
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
        </Grid>
      </Grid>
    </div>
  );
}
