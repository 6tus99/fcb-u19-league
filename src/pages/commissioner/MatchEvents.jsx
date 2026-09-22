import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function MatchEvents() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase.from('matches').select('*').order('scheduled_at', { ascending: false }),
      supabase.from('teams').select('*'),
    ]).then(([m, t]) => {
      setMatches(m.data || []);
      setTeams(t.data || []);
      if (m.data && m.data.length > 0) setSelectedId(m.data[0].id);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    supabase
      .from('match_events')
      .select('*')
      .eq('match_id', selectedId)
      .order('minute', { ascending: true, nullsFirst: false })
      .then(({ data }) => setEvents(data || []));
  }, [selectedId]);

  if (!loaded) return <LoadingSpinner message="Loading events…" />;

  const selected = matches.find((m) => m.id === selectedId);
  const teamName = (id) => teams.find((t) => t.id === id)?.name || 'TBD';

  return (
    <div>
      <PageHeader title="Match Events" subtitle="Browse every recorded event per match" />

      <GlassCard sx={{ mb: 3 }}>
        <TextField
          label="Select a match"
          select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          fullWidth
        >
          {matches.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              W{m.week} • {teamName(m.home_team_id)} {m.status === 'scheduled' ? 'vs' : `${m.home_score}–${m.away_score}`} {teamName(m.away_team_id)} • {m.status}
            </MenuItem>
          ))}
        </TextField>
      </GlassCard>

      <GlassCard title={selected ? `Events — ${formatDate(selected.scheduled_at)}` : 'Events'}>
        {events.length === 0 ? (
          <EmptyState message="No events recorded for this match." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((ev) => (
              <Box key={ev.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Typography sx={{ width: 44, fontWeight: 800, color: 'text.secondary' }}>
                  {ev.minute != null ? `${ev.minute}'` : '—'}
                </Typography>
                <Typography sx={{ textTransform: 'capitalize', fontWeight: 600, width: 110 }}>
                  {ev.event_type.replace('_', ' ')}
                </Typography>
                {ev.team_id && (
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: teams.find((t) => t.id === ev.team_id)?.color || 'grey' }} />
                )}
                <Typography sx={{ flex: 1 }}>{ev.description}</Typography>
                <RouterLink to={`/matches/${ev.match_id}`} style={{ fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                  Open match →
                </RouterLink>
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>
    </div>
  );
}
