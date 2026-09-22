import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Grid from '@mui/material/Grid';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

const EVENT_ICONS = {
  goal: '⚽',
  yellow_card: '🟨',
  red_card: '🟥',
  substitution: '🔁',
  note: '📝',
};

export default function MatchDetail() {
  const { id } = useParams();
  const [match, setMatch] = useState(null);
  const [teams, setTeams] = useState([]);
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const loadMatch = useCallback(async () => {
    const [{ data }, t, e] = await Promise.all([
      supabase.from('matches').select('*').eq('id', id).maybeSingle(),
      supabase.from('teams').select('*'),
      supabase
        .from('match_events')
        .select('*')
        .eq('match_id', id)
        .order('minute', { ascending: true, nullsFirst: false }),
    ]);
    setMatch(data);
    setTeams(t.data || []);
    setEvents(e.data || []);
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  // Live updates while the match is in progress
  useEffect(() => {
    if (!match || match.status !== 'live') return undefined;
    const channel = supabase
      .channel(`match-detail-${match.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches', filter: `id=eq.${match.id}` }, () => loadMatch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_events', filter: `match_id=eq.${match.id}` }, () => loadMatch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [match, loadMatch]);

  if (!loaded) return <LoadingSpinner message="Loading match…" />;
  if (!match) return <EmptyState message="Match not found." />;

  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);

  return (
    <Box>
      <Link component={RouterLink} to="/matches" variant="body2" sx={{ fontWeight: 600 }}>
        ← All matches
      </Link>

      <Paper
        sx={{
          mt: 1.5,
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: '1px solid rgba(255,255,255,0.08)',
          bgcolor: 'rgba(255,255,255,0.03)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography color="text.secondary">
            Week {match.week} • {formatDate(match.scheduled_at, true)}
            {match.venue ? ` • ${match.venue}` : ''}
          </Typography>
          <StatusChip status={match.status} />
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1, textAlign: 'right' }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: home ? home.color : 'grey', ml: 'auto', mb: 1 }} />
            <Typography variant="h5">{home ? home.name : 'TBD'}</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h2" sx={{ fontWeight: 900, color: match.status === 'live' ? 'primary.main' : 'inherit' }}>
              {match.status === 'scheduled' ? 'vs' : `${match.home_score} : ${match.away_score}`}
            </Typography>
            {match.status === 'scheduled' && (
              <Typography variant="body2" color="text.secondary">
                {new Date(match.scheduled_at).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </Typography>
            )}
          </Box>
          <Box sx={{ flex: 1, textAlign: 'left' }}>
            <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: away ? away.color : 'grey', mb: 1 }} />
            <Typography variant="h5">{away ? away.name : 'TBD'}</Typography>
          </Box>
        </Box>
      </Paper>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid size={{ xs: 12 }}>
          <GlassCard title="Match events">
            {events.length === 0 ? (
              <EmptyState message={match.status === 'scheduled' ? 'The match has not started yet.' : 'No events recorded yet.'} />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                {events.map((ev) => {
                  const team = teams.find((t) => t.id === ev.team_id);
                  return (
                    <Box
                      key={ev.id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        py: 1,
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                      }}
                    >
                      <Typography sx={{ width: 44, fontWeight: 800, color: 'text.secondary' }}>
                        {ev.minute != null ? `${ev.minute}'` : '—'}
                      </Typography>
                      <Typography sx={{ fontSize: 20 }}>{EVENT_ICONS[ev.event_type] || '📝'}</Typography>
                      {team && <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: team.color }} />}
                      <Typography>{ev.description || ev.event_type.replace('_', ' ')}</Typography>
                    </Box>
                  );
                })}
              </Box>
            )}
          </GlassCard>
        </Grid>
      </Grid>
    </Box>
  );
}
