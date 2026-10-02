import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import { useThemeMode } from '../context/ThemeContext';

export default function ThemeToggleFloat() {
  const { mode, toggle } = useThemeMode();
  return (
    <Box sx={{ position: 'fixed', top: 12, right: 12, zIndex: 1200 }}>
      <IconButton
        onClick={toggle}
        aria-label="Toggle light/dark mode"
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          color: 'text.secondary',
          '&:hover': { bgcolor: 'tint' },
        }}
      >
        {mode === 'dark' ? <LightModeRounded /> : <DarkModeRounded />}
      </IconButton>
    </Box>
  );
}
