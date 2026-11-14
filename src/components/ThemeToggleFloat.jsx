import React from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import { useThemeMode } from '../context/ThemeContext';

// Instant toggle: one tap flips light/dark immediately (no menu),
// same behaviour as the theme button in the main app header.
export default function ThemeToggleFloat() {
  const { mode, setChoice } = useThemeMode();
  const isDark = mode === 'dark';

  return (
    <Box sx={{ position: 'fixed', top: 12, right: 12, zIndex: 1200 }}>
      <IconButton
        onClick={() => setChoice(isDark ? 'light' : 'dark')}
        aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title={isDark ? 'Light mode' : 'Dark mode'}
        sx={{
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'cardBorder',
          color: 'text.secondary',
          '&:hover': { bgcolor: 'tint' },
        }}
      >
        {isDark ? <LightModeRounded /> : <DarkModeRounded />}
      </IconButton>
    </Box>
  );
}
