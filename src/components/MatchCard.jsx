import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import StatusChip from './StatusChip';
import { formatDate } from '../utils/standings';

export default function MatchCard({ match, teams }) {
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const isLive = match.status === 'live';

  return (
    <Card
      component={RouterLink}
      to={`/matches/${match.id}`}
      sx={{
        bgcolor: 'tint',
        border: '1px solid', borderColor: 'divider',
        display: 'block',
        transition: 'all 0.15s ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: 'rgba(74,222,128,0.45)' },
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Week {match.week}
          </Typography>
          <StatusChip status={match.status} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, justifyContent: 'flex-end', minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, textAlign: 'right' }} noWrap>
              {home ? home.name : 'TBD'}
            </Typography>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: home ? home.primary_color : 'grey', flexShrink: 0 }} />
          </Box>
          <Box
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 2,
              bgcolor: 'rgba(0,0,0,0.35)',
              border: '1px solid', borderColor: 'divider',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: 16, color: isLive ? 'primary.main' : 'inherit' }}>
              {match.status === 'scheduled' ? formatDate(match.scheduled_at, true) : `${match.home_score} – ${match.away_score}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flex: 1, minWidth: 0 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: away ? away.primary_color : 'grey', flexShrink: 0 }} />
            <Typography sx={{ fontWeight: 700 }} noWrap>
              {away ? away.name : 'TBD'}
            </Typography>
          </Box>
        </Box>
        {match.venue && (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1, textAlign: 'center' }}>
            {match.venue}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
