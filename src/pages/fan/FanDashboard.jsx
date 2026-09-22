import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { computeStandings, formatDate } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

export default function FanDashboard() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [news, setNews] = useState([]);
  const [season, setSeason] = useState('');
  const [leagueName, setLeagueName] = useState('FCB Under 19 Football League');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('matches').select('*'),
      supabase.from('news').select('*').order('created_at', { ascending: false }).limit(3),
      supabase.from('league_settings').select('key, value'),
    ]).then(([t, m, n, s]) => {
      setTeams(t.data || []);
      setMatches(m.data || []);
      setNews(n.data || []);
      (s.data || []).forEach((row) => {
        if (row.key === 'season' && row.value) setSeason(row.value);
        if (row.key === 'league_name' && row.value) setLeagueName(row.value);
      });
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingSpinner message="Loading the league…" />;

  const nextMatches = matches
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 4);
  const liveMatches = matches.filter((m) => m.status === 'live');
  const top5 = computeStandings(matches, teams).slice(0, 5);
  const firstName = (profile?.full_name || profile?.email || '').split(' ')[0];

  return (
    <Box>
      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          mb: 3,
          borderRadius: 3,
          background:
            'linear-gradient(120deg, rgba(34,197,94,0.16), rgba(10,15,28,0.4) 55%, rgba(59,130,246,0.14))',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Typography variant="h4">{leagueName}</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          {season} — Welcome back, {firstName}!
        </Typography>
      </Paper>

      {liveMatches.length > 0 && (
        <GlassCard title="Live now" sx={{ mb: 3 }}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {liveMatches.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </Box>
        </GlassCard>
      )}

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard
            title="Next fixtures"
            action={
              <Link component={RouterLink} to="/matches" variant="body2">
                All matches
              </Link>
            }
          >
            {nextMatches.length === 0 ? (
              <EmptyState message="No upcoming fixtures." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {nextMatches.map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard
            title="Standings"
            action={
              <Link component={RouterLink} to="/standings" variant="body2">
                Full table
              </Link>
            }
            sx={{ mb: 3 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {top5.map((r, i) => (
                <Box
                  key={r.team.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.5,
                    borderRadius: 1.5,
                    bgcolor: i === 0 ? 'rgba(250,204,21,0.08)' : 'transparent',
                  }}
                >
                  <Typography sx={{ width: 20, fontWeight: 800, color: i === 0 ? 'secondary.main' : 'text.secondary' }}>
                    {i + 1}
                  </Typography>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.team.color, flexShrink: 0 }} />
                  <Typography sx={{ flex: 1, fontWeight: 600 }} noWrap>
                    {r.team.name}
                  </Typography>
                  <Typography sx={{ fontWeight: 800, color: 'primary.main' }}>{r.Pts}</Typography>
                </Box>
              ))}
            </Box>
          </GlassCard>

          <GlassCard
            title="Latest news"
            action={
              <Link component={RouterLink} to="/news" variant="body2">
                All news
              </Link>
            }
          >
            {news.length === 0 ? (
              <EmptyState message="No news yet." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {news.map((n) => (
                  <Link
                    key={n.id}
                    component={RouterLink}
                    to={`/news/${n.id}`}
                    sx={{
                      textDecoration: 'none',
                      color: 'inherit',
                      '&:hover .news-title': { color: 'primary.main' },
                    }}
                  >
                    <Typography className="news-title" sx={{ fontWeight: 700, transition: 'color .15s' }}>
                      {n.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(n.created_at)}
                    </Typography>
                  </Link>
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
