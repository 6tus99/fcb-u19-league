import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import StandingsTable from '../../components/StandingsTable';
import { computeStandings } from '../../utils/standings';
import supabase from '../../lib/supabase';
import useAutoRefresh from '../../hooks/useAutoRefresh';

export default function Standings() {
  const { profile } = useAuth();
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [detailed, setDetailed] = useState(false); // trimmed by default, tap to expand

  const load = useCallback(() => {
    Promise.all([supabase.from('teams').select('*'), supabase.from('matches').select('*')]).then(([t, m]) => {
      setTeams(t.data || []);
      setMatches(m.data || []);
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, 15000);

  if (!loaded) return <LoadingSpinner message="Calculating standings…" />;

  const rows = computeStandings(matches, teams);

  return (
    <div>
      <PageHeader title="Standings" subtitle="League table — updated automatically from finished matches" />
      <GlassCard
        accent="green"
        title={
          <Box
            onClick={() => setDetailed((d) => !d)}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.75,
              cursor: 'pointer',
              userSelect: 'none',
              '&:hover': { opacity: 0.85 },
            }}
          >
            <ChevronRightRounded
              sx={{
                fontSize: 22,
                transform: detailed ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.2s ease',
              }}
            />
            <span>Standings</span>
            <Box
              component="span"
              sx={{
                fontSize: 11,
                fontWeight: 700,
                color: 'text.secondary',
                ml: 0.5,
                textTransform: 'none',
              }}
            >
              {detailed ? '· tap to trim' : '· tap for full table'}
            </Box>
          </Box>
        }
      >
        <Collapse in={!detailed} timeout={200} unmountOnExit>
          <StandingsTable rows={rows} myTeamId={profile?.team_id} detailed={false} />
        </Collapse>
        <Collapse in={detailed} timeout={200} unmountOnExit>
          <StandingsTable rows={rows} myTeamId={profile?.team_id} detailed />
          <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'block', sm: 'none' }, mt: 1 }}>
            Swipe sideways to see all stats
          </Typography>
        </Collapse>
      </GlassCard>
    </div>
  );
}
