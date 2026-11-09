import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useThemeMode } from '../context/ThemeContext';

// The page sits on the navy gradient in BOTH themes, so the header text is
// always light: ice sky blue on light mode, white on dark mode.
export default function PageHeader({ title, subtitle, action }) {
  const { mode } = useThemeMode();
  const isLight = mode === 'light';
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 1,
        mb: 3,
      }}
    >
      <Box>
        <Typography variant="h4" sx={{ color: isLight ? '#d8ecff' : '#ffffff' }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography sx={{ mt: 0.5, color: isLight ? 'rgba(216, 236, 255, 0.85)' : 'rgba(255, 255, 255, 0.78)' }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
