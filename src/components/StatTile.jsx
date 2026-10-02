import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { alpha, useTheme } from '@mui/material/styles';

const TONES = {
  green: { light: '#16a34a', dark: '#4ade80' },
  blue: { light: '#2563eb', dark: '#93c5fd' },
  amber: { light: '#ca8a04', dark: '#facc15' },
  red: { light: '#dc2626', dark: '#f87171' },
  slate: { light: '#475569', dark: '#94a3b8' },
};

export default function StatTile({ icon, label, value, sub, tone = 'green', to }) {
  const theme = useTheme();
  const fg = TONES[tone][theme.palette.mode];
  return (
    <Box
      component={to ? RouterLink : 'div'}
      to={to}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2 },
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3.5,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
        textDecoration: 'none',
        color: 'inherit',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
        height: '100%',
        ...(to
          ? {
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: `0 14px 30px ${alpha(fg, 0.22)}`,
                borderColor: alpha(fg, 0.45),
              },
            }
          : {}),
      }}
    >
      <Box
        sx={{
          width: { xs: 46, sm: 52 },
          height: { xs: 46, sm: 52 },
          borderRadius: 3,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: alpha(fg, 0.12),
          color: fg,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h5" noWrap sx={{ fontWeight: 800, lineHeight: 1.15 }}>
          {value}
        </Typography>
        <Typography variant="body2" noWrap color="text.secondary" sx={{ fontWeight: 600 }}>
          {label}
        </Typography>
        {sub && (
          <Typography variant="caption" noWrap color="text.secondary" sx={{ display: 'block' }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
