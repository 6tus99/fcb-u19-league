import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import supabase from '../../lib/supabase';

export default function CommissionerDashboard() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([supabase.from('teams').select('*'), supabase.from('matches').select('*')]).then(([t, m]) => {
      setTeams(t.data || []);
      setMatches(m.data || []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingSpinner message="Loading commissioner dashboard…" />;

  const live = matches.filter((m) => m.status === 'live');
  const upcoming = matches
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 4);
  const finished = matches
    .filter((m) => m.status === 'finished')
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
    .slice(0, 4);

  return (
    <div>
      <PageHeader
        title="Commissioner Dashboard"
        subtitle="Control live matches, review events and reports"
        action={
          <Button component={RouterLink} to="/commissioner/live" variant="contained" startIcon={<PlayArrowRounded />}>
            Live Match Control
          </Button>
        }
      />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard title="Live now">
            {live.length === 0 ? (
              <EmptyState message="No matches are live right now." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {live.map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <GlassCard title="Up next">
            {upcoming.length === 0 ? (
              <EmptyState message="No upcoming matches." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {upcoming.map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <GlassCard title="Recently finished">
            {finished.length === 0 ? (
              <EmptyState message="No finished matches yet." />
            ) : (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
                {finished.map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>
      </Grid>
    </div>
  );
}
