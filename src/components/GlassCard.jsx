import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

export default function GlassCard({ title, action, children, sx }) {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
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
        borderColor: 'divider',
        backdropFilter: 'blur(8px)',
        boxShadow: dark
          ? '0 10px 28px rgba(2, 6, 23, 0.45), inset 0 1px 0 rgba(148, 163, 184, 0.12)'
          : '0 1px 3px rgba(15, 23, 42, 0.06)',
        ...(sx || {}),
      }}
    >
      <CardContent>
        {(title || action) && (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            {title && <Typography variant="h6">{title}</Typography>}
            {action}
          </Box>
        )}
        {children}
      </CardContent>
    </Card>
  );
}
