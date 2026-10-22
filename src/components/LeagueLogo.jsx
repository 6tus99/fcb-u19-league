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

/**
 * The league logo — used everywhere the league logo stands.
 * A little white BALL whose surface carries BOTH logos side by side
 * (league crest, First Capital Bank, crest, Bank…) and rolls around
 * it continuously (keyframes in index.css, left to right). Each logo
 * takes 5 seconds to cross the face, so the two logos alternate
 * naturally as the ball rolls — nothing flips, nothing swaps. If
 * the league admin sets a custom logo in Settings, that one rolls
 * on the surface with the sponsor logo instead of the crest.
 */
export default function LeagueLogo({ size = 32, sx = {} }) {
  const [base, setBase] = useState(crestUrl);

  useEffect(() => {
    let on = true;
    fetchCustomLogo().then((url) => {
      if (on && url) setBase(url);
    });
    return () => {
      on = false;
    };
  }, []);

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
      {/*
        The rolling surface: crest + sponsor, each twice, so the loop
        point looks identical to the start. The strip is 200% of the
        ball, each tile is half the ball — so the face always shows
        the two logos SIDE BY SIDE. One pass takes 10s = 5s per logo.
      */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: '200%',
          display: 'flex',
          animation: 'logo-surface 10s linear infinite',
        }}
      >
        {[base, fcbUrl, base, fcbUrl].map((src, i) => (
          <Box
            key={i}
            sx={{
              width: '25%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={src}
              alt={i === 0 ? 'League logo' : ''}
              draggable={false}
              sx={{ width: '85%', height: '85%', objectFit: 'contain', display: 'block' }}
            />
          </Box>
        ))}
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
