import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { computeStandings, formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';
import useAutoRefresh from '../../hooks/useAutoRefresh';

export default function FanDashboard() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [news, setNews] = useState([]);
  const [adUrl, setAdUrl] = useState('');
  const [adLink, setAdLink] = useState('');
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
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
        if (row.key === 'ad_banner_url' && row.value) setAdUrl(row.value);
        if (row.key === 'ad_banner_link' && row.value) setAdLink(row.value);
      });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, 15000);

  if (!loaded) return <LoadingSpinner message="Loading the league…" />;

  const scheduledMatches = matches
    .filter((m) => m.status === 'scheduled')
    .sort((a, b) => (a.scheduled_at ? new Date(a.scheduled_at) : Infinity) - (b.scheduled_at ? new Date(b.scheduled_at) : Infinity));
  const now = new Date();
  const isToday = (d) => {
    const x = new Date(d);
    return (
      x.getFullYear() === now.getFullYear() &&
      x.getMonth() === now.getMonth() &&
      x.getDate() === now.getDate()
    );
  };
  // "Upcoming" = today's games (or the 3 nearest ones if nothing is on today);
  // "Next fixtures" = everything else still to play this season.
  const todaysMatches = scheduledMatches.filter((m) => isToday(m.scheduled_at));
  const upcomingMatches = todaysMatches.length > 0 ? todaysMatches : scheduledMatches.slice(0, 3);
  const laterMatches = scheduledMatches.filter((m) => !upcomingMatches.includes(m));
  const top5 = computeStandings(matches, teams).slice(0, 5);

  return (
    <Box>
      {/* Ad slot — sponsor banner placed by the league admin (League Settings). */}
      <Box sx={{ mb: 3 }}>
        {adUrl ? (
          <Box
            component={adLink ? 'a' : 'div'}
            href={adLink || undefined}
            target={adLink ? '_blank' : undefined}
            rel={adLink ? 'noreferrer' : undefined}
            sx={{
              display: 'block',
              borderRadius: 3,
              overflow: 'hidden',
              border: '1px solid',
              borderColor: 'cardBorder',
              boxShadow: '0 2px 12px rgba(15, 23, 42, 0.1)',
            }}
          >
            <Box component="img" src={adUrl} alt="Sponsor" sx={{ width: '100%', display: 'block' }} />
          </Box>
        ) : (
          <Box
            sx={{
              borderRadius: 3,
              border: '1.5px dashed',
              borderColor: 'divider',
              bgcolor: 'tint',
              p: { xs: 3, md: 4 },
              textAlign: 'center',
            }}
          >
            <Typography sx={{ fontWeight: 800, color: 'text.secondary' }}>Your ad here</Typography>
            <Typography variant="caption" color="text.secondary">
              Sponsor slot — the league admin places ads in League Settings.
            </Typography>
          </Box>
        )}
      </Box>

      <GlassCard
        title={todaysMatches.length > 0 ? "Today's matches" : 'Upcoming matches'}
        accent="orange"
        sx={{ mb: 3 }}
        action={
          <Link component={RouterLink} to="/matches" variant="body2">
            All matches
          </Link>
        }
      >
        {upcomingMatches.length === 0 ? (
          <EmptyState message="No matches scheduled." />
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {upcomingMatches.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </Box>
        )}
      </GlassCard>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <GlassCard
            title="Next fixtures"
            accent="red"
            action={
              <Link component={RouterLink} to="/matches" variant="body2">
                All matches
              </Link>
            }
          >
            {laterMatches.length === 0 ? (
              <EmptyState message="No further fixtures after the upcoming ones." />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {laterMatches.map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </Box>
            )}
          </GlassCard>
        </Grid>

        <Grid size={{ xs: 12, md: 5 }}>
          <GlassCard
            title="Standings"
            accent="green"
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
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: r.team.primary_color, flexShrink: 0 }} />
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
            accent="yellow"
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
