import React from 'react';
import Chip from '@mui/material/Chip';

const STYLES = {
  scheduled: { bgcolor: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
  live: { bgcolor: 'rgba(239,68,68,0.22)', color: '#fca5a5' },
  finished: { bgcolor: 'rgba(148,163,184,0.15)', color: '#cbd5e1' },
};

const LABELS = {
  scheduled: 'Scheduled',
  live: '● LIVE',
  finished: 'Full Time',
};

export default function StatusChip({ status }) {
  return (
    <Chip
      size="small"
      label={LABELS[status] || status}
      sx={{
        ...(STYLES[status] || {}),
        fontWeight: 700,
        ...(status === 'live' ? { animation: 'pulse 1.6s ease-in-out infinite' } : {}),
      }}
    />
  );
}
