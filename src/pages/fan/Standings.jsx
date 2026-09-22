import React, { useEffect, useState } from 'react';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import StandingsTable from '../../components/StandingsTable';
import { computeStandings } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function Standings() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([supabase.from('teams').select('*'), supabase.from('matches').select('*')]).then(([t, m]) => {
      setTeams(t.data || []);
      setMatches(m.data || []);
      setLoaded(true);
    });
  }, []);

  if (!loaded) return <LoadingSpinner message="Calculating standings…" />;

  return (
    <div>
      <PageHeader title="Standings" subtitle="League table — updated automatically from finished matches" />
      <GlassCard>
        <StandingsTable rows={computeStandings(matches, teams)} />
      </GlassCard>
    </div>
  );
}
