import React from 'react';
import Chip from '@mui/material/Chip';

const MAP = {
  pending: { color: 'warning', label: 'Pending' },
  approved: { color: 'success', label: 'Approved' },
  rejected: { color: 'error', label: 'Rejected' },
};

export default function StatusChip({ status }) {
  const m = MAP[status] || { color: 'default', label: status };
  return (
    <Chip
      size="small"
      label={m.label}
      color={m.color}
      sx={{ fontWeight: 700, height: 20, fontSize: 11 }}
    />
  );
}
