import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function MatchReports() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [eventsByMatch, setEventsByMatch] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('*').eq('status', 'finished').order('scheduled_at', { ascending: false }),
      supabase.from('teams').select('*'),
      supabase.from('match_events').select('*'),
    ]).then(([m, t, ev]) => {
      setMatches(m.data || []);
      setTeams(t.data || []);
      const grouped = {};
      (ev.data || []).forEach((e) => {
        (grouped[e.match_id] = grouped[e.match_id] || []).push(e);
      });
      setEventsByMatch(grouped);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingSpinner message="Loading reports…" />;

  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'TBD';
  const teamColor = (id) => teams.find((t) => t.id === id)?.primary_color || 'grey';

  return (
    <div>
      <PageHeader title="Match Reports" subtitle="Post-match summaries for every finished game" />

      {matches.length === 0 ? (
        <Paper sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, p: 3 }}>
          <EmptyState message="No finished matches yet." />
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {matches.map((m) => {
            const evs = eventsByMatch[m.id] || [];
            const goals = evs.filter((e) => e.event_type === 'goal');
            const yellows = evs.filter((e) => e.event_type === 'yellow_card').length;
            const reds = evs.filter((e) => e.event_type === 'red_card').length;
            const winner =
              m.home_score > m.away_score ? teamName(m.home_team_id) : m.away_score > m.home_score ? teamName(m.away_team_id) : null;
            return (
              <Paper key={m.id} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'tint' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  <Typography sx={{ fontWeight: 800 }}>
                    <span style={{ color: teamColor(m.home_team_id) }}>{teamName(m.home_team_id)}</span> {m.home_score} – {m.away_score}{' '}
                    <span style={{ color: teamColor(m.away_team_id) }}>{teamName(m.away_team_id)}</span>
                  </Typography>
                  <Link component={RouterLink} to={`/matches/${m.id}`} variant="body2" sx={{ fontWeight: 700 }}>
                    Full match page →
                  </Link>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Week {m.week} • {formatDate(m.scheduled_at, true)}
                  {m.venue ? ` • ${m.venue}` : ''}
                  {winner ? ` • Winner: ${winner}` : ' • Draw'}
                </Typography>

                {goals.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      GOALS
                    </Typography>
                    {goals.map((g) => (
                      <Box key={g.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.25 }}>
                        <Typography sx={{ width: 40, fontWeight: 800, color: 'text.secondary' }}>
                          {g.minute != null ? `${g.minute}'` : '—'}
                        </Typography>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: teamColor(g.team_id) }} />
                        <Typography variant="body2">{g.description}</Typography>
                      </Box>
                    ))}
                  </Box>
                )}
                <Typography variant="body2" color="text.secondary">
                  Cards: <span style={{ color: '#facc15' }}>{yellows} yellow</span> •{' '}
                  <span style={{ color: '#f87171' }}>{reds} red</span>
                </Typography>
              </Paper>
            );
          })}
        </Box>
      )}
    </div>
  );
}
