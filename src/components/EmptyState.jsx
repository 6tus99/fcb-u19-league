import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import InboxRounded from '@mui/icons-material/InboxRounded';

export default function EmptyState({ message = 'Nothing here yet.' }) {
  return (
    <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
      <InboxRounded sx={{ fontSize: 44, mb: 1, opacity: 0.6 }} />
      <Typography>{message}</Typography>
    </Box>
  );
}
