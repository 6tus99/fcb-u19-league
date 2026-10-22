import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import crestUrl from '../assets/bdyfc-logo.png';
import fcbUrl from '../assets/fcbank-logo.png';
import supabase from '../lib/supabase';

let logoPromise = null;

/** Fetch the admin-configured league logo once (module-level cache). */
function fetchCustomLogo() {
  if (!logoPromise) {
    logoPromise = supabase
      .from('league_settings')
      .select('value')
      .eq('key', 'logo_url')
      .maybeSingle()
      .then(({ data }) => data?.value || null)
      .catch(() => null);
  }
  return logoPromise;
}

const SWAP_MS = 5000;

/**
 * The league logo — used everywhere the league logo stands.
 * It sits on a little white BALL: the surface rolls across the ball
 * (keyframes in index.css, left to right, one pass every 5 seconds)
 * and the logo never flips — it travels around the surface like a
 * marking on a rolling ball. At the loop point the surface swaps to
 * the other logo (league crest / First Capital Bank). If the league
 * admin sets a custom logo in Settings, that one rolls with the
 * sponsor logo instead of the crest.
 */
export default function LeagueLogo({ size = 32, sx = {} }) {
  const [base, setBase] = useState(crestUrl);
  const [showSponsor, setShowSponsor] = useState(false);

  useEffect(() => {
    let on = true;
    fetchCustomLogo().then((url) => {
      if (on && url) setBase(url);
    });
    return () => {
      on = false;
    };
  }, []);

  useEffect(() => {
    // Matches the 5s surface pass, so the swap lands exactly at the
    // loop point (both logos are fully on the ball's face).
    const id = setInterval(() => {
      setShowSponsor((s) => !s);
    }, SWAP_MS);
    return () => clearInterval(id);
  }, []);

  const src = showSponsor ? fcbUrl : base;

  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        // The ball itself: soft white with 3D shading
        background: 'radial-gradient(circle at 32% 28%, #ffffff 0%, #f4f4f4 45%, #d9d9d9 80%, #b8b8b8 100%)',
        boxShadow: 'inset -3px -4px 8px rgba(0, 0, 0, 0.30), inset 3px 4px 6px rgba(255, 255, 255, 0.9)',
        animation: 'logo-glow 2.5s ease-in-out infinite',
        ...sx,
      }}
    >
      {/* The rolling surface: two identical tiles, looped seamlessly */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: '200%',
          display: 'flex',
          animation: 'logo-surface 5s linear infinite',
        }}
      >
        <Box
          component="img"
          src={src}
          alt=""
          draggable={false}
          sx={{ width: '50%', height: '100%', objectFit: 'contain', padding: '12%', display: 'block' }}
        />
        <Box
          component="img"
          src={src}
          alt=""
          draggable={false}
          sx={{ width: '50%', height: '100%', objectFit: 'contain', padding: '12%', display: 'block' }}
        />
      </Box>
      {/* Light on top of the ball so it reads as 3D */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          pointerEvents: 'none',
          background:
            'radial-gradient(circle at 32% 26%, rgba(255, 255, 255, 0.75) 0%, rgba(255, 255, 255, 0) 42%, rgba(0, 0, 0, 0.22) 100%)',
        }}
      />
    </Box>
  );
}
