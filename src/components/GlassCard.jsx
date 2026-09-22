import React from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function GlassCard({ title, action, children, sx }) {
  return (
    <Card
      sx={{
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
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
