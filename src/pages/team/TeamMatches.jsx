import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import MatchCard from '../../components/MatchCard';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';
import useAutoRefresh from '../../hooks/useAutoRefresh';

/**
 * The signed-in user's own team matches ONLY — every match of theirs
 * recorded in the league (upcoming, live and finished). Shared by the
 * manager and player dashboards.
 */
export default function TeamMatches() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('matches').select('*'),
    ]);
    setTeams(t.data || []);
    setMatches(m.data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, 15000);

  if (!loaded) return <LoadingSpinner message="Loading your team's matches…" />;

  const team = teams.find((t) => t.id === profile?.team_id);

  if (!team) {
    return (
      <div>
        <PageHeader title="My team's matches" subtitle="Every match your team has played or will play" />
        <EmptyState message="You're not linked to a team yet. Ask the league admin to assign your team." />
      </div>
    );
  }

  const mine = matches
    .filter((m) => m.home_team_id === team.id || m.away_team_id === team.id)
    .sort(
      (a, b) =>
        (a.scheduled_at ? new Date(a.scheduled_at) : Infinity) -
        (b.scheduled_at ? new Date(b.scheduled_at) : Infinity)
    );
  const upcoming = mine.filter((m) => m.status !== 'finished');
  const recent = mine.filter((m) => m.status === 'finished').reverse();

  return (
    <div>
      <PageHeader
        title={`${team.name} — matches`}
        subtitle="Every match your team has played or will play this season"
      />

      <GlassCard title={`Upcoming (${upcoming.length})`} accent="orange" sx={{ mb: 3 }}>
        {upcoming.length === 0 ? (
          <EmptyState message="No upcoming matches for your team." />
        ) : (
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
            {upcoming.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </Box>
        )}
      </GlassCard>

      <GlassCard title={`Recent results (${recent.length})`} accent="green">
        {recent.length === 0 ? (
          <EmptyState message="Your team hasn't played a match yet." />
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
