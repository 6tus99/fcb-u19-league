import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';

export default function NotFound() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2, textAlign: 'center' }}>
      <SportsSoccerRounded color="primary" sx={{ fontSize: 64 }} />
      <Typography variant="h2" sx={{ fontWeight: 900, my: 1 }}>
        404
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        That page went offside. It does not exist.
      </Typography>
      <Button component={RouterLink} to="/" variant="contained">
        Back to the league
      </Button>
    </Box>
  );
}
