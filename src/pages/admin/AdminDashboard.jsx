import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import supabase from '../../lib/supabase';

function StatCard({ label, value, to, color = '#4ade80' }) {
  return (
    <Paper
      component={to ? RouterLink : 'div'}
      to={to}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid rgba(255,255,255,0.08)',
        bgcolor: 'rgba(255,255,255,0.03)',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
        '&:hover': to ? { borderColor: 'rgba(74,222,128,0.45)' } : {},
      }}
    >
      <Typography variant="h3" sx={{ fontWeight: 900, color }}>
        {value}
      </Typography>
      <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
        {label}
      </Typography>
    </Paper>
  );
}

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ users: 0, teams: 0, scheduled: 0, live: 0, finished: 0, news: 0, officials: 0 });
  const [teams, setTeams] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const count = (table) => supabase.from(table).select('*', { count: 'exact', head: true });
    Promise.all([
      count('profiles'),
      count('teams'),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'scheduled'),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'live'),
      supabase.from('matches').select('*', { count: 'exact', head: true }).eq('status', 'finished'),
      count('news'),
      count('officials'),
      supabase.from('teams').select('*'),
      supabase.from('matches').select('*').order('scheduled_at', { ascending: false }).limit(4),
    ]).then(([u, t, s, l, f, n, o, teamsData, matchesData]) => {
      setCounts({
        users: u.count || 0,
        teams: t.count || 0,
        scheduled: s.count || 0,
        live: l.count || 0,
        finished: f.count || 0,
        news: n.count || 0,
        officials: o.count || 0,
      });
      setTeams(teamsData || []);
      setRecent(matchesData || []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingSpinner message="Loading admin dashboard…" />;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Overview of the whole league" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Registered users" value={counts.users} to="/admin/users" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Teams" value={counts.teams} to="/admin/teams" color="#38bdf8" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="Matches (live / finished)" value={`${counts.live} / ${counts.finished}`} to="/admin/matches" color="#f87171" />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatCard label="News articles" value={counts.news} to="/admin/news" color="#facc15" />
        </Grid>
      </Grid>

      <GlassCard title="Latest activity" action={<Link component={RouterLink} to="/admin/matches" variant="body2">Manage matches</Link>}>
        {recent.length === 0 ? (
          <EmptyState message="No matches yet." />
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {recent.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </Box>
        )}
      </GlassCard>
    </div>
  );
}
