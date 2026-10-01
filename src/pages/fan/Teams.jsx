import React, { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import LoadingSpinner from '../../components/LoadingSpinner';
import { computeStandings } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function Teams() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([supabase.from('teams').select('*').order('name'), supabase.from('matches').select('*')]).then(
      ([t, m]) => {
        setTeams(t.data || []);
        setMatches(m.data || []);
        setLoaded(true);
      }
    );
  }, []);

  if (!loaded) return <LoadingSpinner message="Loading teams…" />;

  const standings = computeStandings(matches, teams);
  const rankFor = (id) => standings.findIndex((r) => r.team.id === id);

  return (
    <div>
      <PageHeader title="Teams" subtitle={`${teams.length} clubs competing this season`} />
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' } }}>
        {teams.map((t) => {
          const row = standings.find((r) => r.team.id === t.id);
          return (
            <Card
              key={t.id}
              component={RouterLink}
              to={`/teams/${t.id}`}
              sx={{
                bgcolor: 'tint',
                border: '1px solid', borderColor: 'divider',
                transition: 'all .15s ease',
                '&:hover': { transform: 'translateY(-2px)', borderColor: 'rgba(74,222,128,0.45)' },
              }}
            >
              <CardContent>
                <Box sx={{ height: 6, borderRadius: 3, bgcolor: t.primary_color, mb: 2 }} />
                <Typography variant="h6">{t.name}</Typography>
                <Typography color="text.secondary" variant="body2">
                  {t.short_name}
                  {t.city ? ` • ${t.city}` : ''}
                </Typography>
                {row && (
                  <Typography variant="body2" sx={{ mt: 1.5, fontWeight: 600 }}>
                    #{rankFor(t.id) + 1} • {row.Pts} pts • {row.W}W {row.D}D {row.L}L
                  </Typography>
                )}
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </div>
  );
}
