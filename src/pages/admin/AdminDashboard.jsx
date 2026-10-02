import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import PersonRounded from '@mui/icons-material/PersonRounded';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import ArticleRounded from '@mui/icons-material/ArticleRounded';
import StatTile from '../../components/StatTile';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function AdminDashboard() {
  const [counts, setCounts] = useState({ users: 0, teams: 0, scheduled: 0, live: 0, finished: 0, news: 0, officials: 0 });
  const [teams, setTeams] = useState([]);
  const [recent, setRecent] = useState([]);
  const [pending, setPending] = useState([]);
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
      supabase
        .from('requests')
        .select(
          '*, player:profiles!requests_player_profile_id_fkey (id, full_name), team:teams!requests_team_id_fkey (id, name), from_team:teams!requests_from_team_id_fkey (id, name), requester:profiles!requests_requested_by_fkey (id, full_name)'
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(([u, t, s, l, f, n, o, teamsData, matchesData, reqData]) => {
      setCounts({
        users: u.count || 0,
        teams: t.count || 0,
        scheduled: s.count || 0,
        live: l.count || 0,
        finished: f.count || 0,
        news: n.count || 0,
        officials: o.count || 0,
      });
      setTeams(teamsData?.data || []);
      setRecent(matchesData?.data || []);
      setPending(reqData?.data || []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingSpinner message="Loading admin dashboard…" />;

  return (
    <div>
      <PageHeader title="Admin Dashboard" subtitle="Overview of the whole league" />

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<PersonRounded sx={{ fontSize: 26 }} />}
            label="Registered users"
            value={counts.users}
            tone="green"
            to="/admin/users"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<SportsSoccerRounded sx={{ fontSize: 26 }} />}
            label="Teams"
            value={counts.teams}
            tone="blue"
            to="/admin/teams"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<LocalFireDepartmentRounded sx={{ fontSize: 26 }} />}
            label="Live / finished matches"
            value={`${counts.live} / ${counts.finished}`}
            tone="red"
            to="/admin/matches"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<ArticleRounded sx={{ fontSize: 26 }} />}
            label="News articles"
            value={counts.news}
            tone="amber"
            to="/admin/news"
          />
        </Grid>
      </Grid>

      <GlassCard
        title="Pending team requests"
        action={<Link component={RouterLink} to="/admin/requests" variant="body2">Review all</Link>}
        sx={{ mb: 3 }}
      >
        {pending.length === 0 ? (
          <EmptyState message="No pending requests. When managers add players or players request transfers, they appear here for your approval." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {pending.map((r) => (
              <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip
                  label={r.type === 'add_player' ? 'Add player' : 'Transfer'}
                  size="small"
                  color="warning"
                  sx={{ fontWeight: 700, height: 20, fontSize: 11 }}
                />
                <Typography sx={{ fontWeight: 600 }}>{r.player?.full_name || 'Unknown'}</Typography>
                <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
                  {r.type === 'add_player'
                    ? `to ${r.team?.name || 'team'}`
                    : `from ${r.from_team?.name || '?'} to ${r.team?.name || '?'}`}
                  {' • requested by '}
                  {r.requester?.full_name || 'unknown'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDate(r.created_at)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>

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
