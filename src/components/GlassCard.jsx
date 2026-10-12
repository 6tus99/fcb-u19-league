import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

// Section accents — each resolves to a theme-aware color (brighter in dark
// mode, deep brand shades in light mode).
const ACCENTS = {
  green: (t) => t.palette.success.main, // #16a34a / #4ade80
  red: (t) => t.palette.error.main, // #dc2626 / #f87171
  yellow: (t) => t.palette.secondary.main, // #ca8a04 / #facc15
  blue: (t) => (t.palette.mode === 'dark' ? '#60a5fa' : '#1e3a8a'),
};

const hexToRgba = (hex, a) => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export default function GlassCard({ title, action, children, sx, accent }) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const baseShadow = dark
    ? '0 10px 28px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(148, 163, 184, 0.12)'
    : '0 1px 3px rgba(15, 23, 42, 0.06)';
  const accentColor = accent && ACCENTS[accent] ? ACCENTS[accent](theme) : null;

  return (
    <Card
      sx={{
        bgcolor: 'tint',
        // dark mode: a soft blue glow from the top-left so cards read as
        // raised surfaces instead of flat patches
        backgroundImage: dark
          ? 'linear-gradient(160deg, rgba(59, 94, 178, 0.18) 0%, rgba(17, 30, 66, 0.04) 55%)'
          : 'none',
        border: '1px solid',
        borderColor: accentColor || 'cardBorder',
        backdropFilter: 'blur(8px)',
        // accent cards get a faint halo in their own color
        boxShadow: accentColor
          ? `${baseShadow}, 0 0 22px ${hexToRgba(accentColor, dark ? 0.22 : 0.16)}`
          : baseShadow,
        ...(sx || {}),
      }}
    >
      <CardContent>
        {(title || action) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            {title && (
              <Typography
                variant="h6"
                sx={accentColor ? { color: accentColor } : undefined}
              >
                {title}
              </Typography>
            )}
            {action}
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
