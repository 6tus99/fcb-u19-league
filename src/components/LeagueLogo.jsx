import React from 'react';
import Box from '@mui/material/Box';
import logoUrl from '../assets/bdyfc-logo.png';

/**
 * The official BDYFC crest — used everywhere the league "ball" used to stand.
 */
export default function LeagueLogo({ size = 32, rounded = 2, sx = {} }) {
  return (
    <Box
      component="img"
      src={logoUrl}
      alt="Blantyre District Youth Football Committee"
      draggable={false}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        bgcolor: '#ffffff',
        borderRadius: rounded,
        display: 'block',
        flexShrink: 0,
        ...sx,
      }}
    />
  );
}
