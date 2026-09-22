import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import MatchCard from '../../components/MatchCard';
import EmptyState from '../../components/EmptyState';
import supabase from '../../lib/supabase';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'finished', label: 'Finished' },
];

export default function Matches() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    Promise.all([supabase.from('teams').select('*'), supabase.from('matches').select('*')]).then(([t, m]) => {
      setTeams(t.data || []);
      setMatches(m.data || []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingSpinner message="Loading matches…" />;

  let filtered = matches;
  if (filter === 'live') filtered = matches.filter((m) => m.status === 'live');
  if (filter === 'upcoming') filtered = matches.filter((m) => m.status === 'scheduled');
  if (filter === 'finished') filtered = matches.filter((m) => m.status === 'finished');

  const weeks = [...new Set(filtered.map((m) => m.week))].sort((a, b) => a - b);

  return (
    <Box>
      <PageHeader
        title="Matches"
        subtitle="Full season schedule, live scores and results"
        action={
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                label={f.label}
                onClick={() => setFilter(f.id)}
                color={filter === f.id ? 'primary' : 'default'}
                variant={filter === f.id ? 'filled' : 'outlined'}
              />
            ))}
          </Box>
        }
      />

      {filtered.length === 0 && <EmptyState message="No matches for this filter." />}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {weeks.map((week) => (
          <GlassCard key={week} title={`Week ${week}`}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              {filtered
                .filter((m) => m.week === week)
                .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
                .map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
            </Box>
          </GlassCard>
        ))}
      </Box>
    </Box>
  );
}
