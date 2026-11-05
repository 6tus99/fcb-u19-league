import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRounded from '@mui/icons-material/ExpandLessRounded';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function MatchReports() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [eventsByMatch, setEventsByMatch] = useState({});
  const [openEvents, setOpenEvents] = useState({}); // matchId -> bool
  const [loaded, setLoaded] = useState(false);

  const toggleEvents = (id) => setOpenEvents((o) => ({ ...o, [id]: !o[id] }));
  const byMinute = (list) =>
    [...list].sort((a, b) => (a.minute ?? 9999) - (b.minute ?? 9999));

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
        <Paper sx={{ border: '1px solid', borderColor: 'cardBorder', borderRadius: 3, p: 3 }}>
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
              <Paper key={m.id} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: '1px solid', borderColor: 'cardBorder', bgcolor: 'tint' }}>
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

                {/* The match's full event timeline lives right here in its
                    report (Match Events is no longer a separate page). */}
                <Button
                  size="small"
                  onClick={() => toggleEvents(m.id)}
                  endIcon={openEvents[m.id] ? <ExpandLessRounded /> : <ExpandMoreRounded />}
                  sx={{ fontWeight: 700, mt: 1 }}
                >
                  {openEvents[m.id] ? 'Hide all events' : `All events (${evs.length})`}
                </Button>
                {openEvents[m.id] &&
                  (evs.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      No events recorded for this match.
                    </Typography>
                  ) : (
                    <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'cardBorder' }}>
                      {byMinute(evs).map((ev) => (
                        <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, borderBottom: '1px solid', borderColor: 'cardBorder', '&:last-child': { borderBottom: 'none' } }}>
                          <Typography sx={{ width: 40, fontWeight: 800, color: 'text.secondary' }}>
                            {ev.minute != null ? `${ev.minute}'` : '—'}
                          </Typography>
                          <Typography sx={{ textTransform: 'capitalize', fontWeight: 600, width: 110 }}>
                            {(ev.event_type || 'event').replace('_', ' ')}
                          </Typography>
                          {ev.team_id && (
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: teamColor(ev.team_id) }} />
                          )}
                          <Typography sx={{ flex: 1 }}>{ev.description}</Typography>
                        </Box>
                      ))}
                    </Box>
                  ))}
              </Paper>
            );
          })}
        </Box>
      )}
    </div>
  );
}
