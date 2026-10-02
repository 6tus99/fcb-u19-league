import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import SportsScoreRounded from '@mui/icons-material/SportsScoreRounded';
import LocalFireDepartmentRounded from '@mui/icons-material/LocalFireDepartmentRounded';
import EmojiEventsRounded from '@mui/icons-material/EmojiEventsRounded';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import GlassCard from '../../components/GlassCard';
import StatTile from '../../components/StatTile';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import { computeStandings, formatDate } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import { useThemeMode } from '../../context/ThemeContext';
import supabase from '../../lib/supabase';

export default function FanDashboard() {
  const { profile } = useAuth();
  const { mode } = useThemeMode();
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
  const goalsScored = matches
    .filter((m) => m.status === 'finished')
    .reduce((s, m) => s + (m.home_score || 0) + (m.away_score || 0), 0);

  return (
    <Box>
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 3.5,
          p: { xs: 3, md: 4 },
          mb: 3,
          color: '#ffffff',
          background:
            mode === 'dark'
              ? 'radial-gradient(120% 180% at 88% 0%, rgba(74,222,128,0.28) 0%, transparent 48%), linear-gradient(120deg, #0d1a3d 15%, #16295e 55%, #14532d 135%)'
              : 'radial-gradient(120% 180% at 88% 0%, rgba(74,222,128,0.4) 0%, transparent 48%), linear-gradient(120deg, #1e3a8a 15%, #1d4ed8 55%, #166534 135%)',
          border: '1px solid rgba(255,255,255,0.14)',
          boxShadow: '0 12px 32px rgba(30,58,138,0.28)',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <SportsSoccerRounded sx={{ fontSize: 34, flexShrink: 0 }} />
          <Typography variant="h4" sx={{ fontWeight: 900 }}>{leagueName}</Typography>
        </Box>
        <Typography sx={{ mt: 0.5, opacity: 0.85, maxWidth: 620 }}>
          {season} — Welcome back, {firstName}!
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          <Chip label={`${teams.length} teams`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#fff', fontWeight: 700 }} />
          <Chip label={`${matches.length} matches`} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.16)', color: '#fff', fontWeight: 700 }} />
          {liveMatches.length > 0 && (
            <Chip label={`${liveMatches.length} live now`} size="small" sx={{ bgcolor: 'rgba(74,222,128,0.3)', color: '#fff', fontWeight: 800 }} />
          )}
        </Box>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<SportsScoreRounded sx={{ fontSize: 26 }} />}
            label="Fixtures scheduled"
            value={matches.filter((m) => m.status === 'scheduled').length}
            tone="blue"
            to="/matches"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<LocalFireDepartmentRounded sx={{ fontSize: 26 }} />}
            label="Live now"
            value={liveMatches.length}
            tone="red"
            to="/matches"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<EmojiEventsRounded sx={{ fontSize: 26 }} />}
            label="Goals this season"
            value={goalsScored}
            tone="green"
            to="/matches"
          />
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <StatTile
            icon={<SportsSoccerRounded sx={{ fontSize: 26 }} />}
            label="League leader"
            value={top5[0] ? top5[0].team.short_name : '—'}
            sub={top5[0] ? `${top5[0].Pts} pts • ${top5[0].P} played` : ''}
            tone="amber"
            to="/standings"
          />
        </Grid>
      </Grid>

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
