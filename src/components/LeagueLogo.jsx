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
 * The logo turns in 3D like a globe: around its vertical axis with
 * perspective (keyframes in index.css), one revolution every 5
 * seconds, and when it faces the viewer again the image swaps with
 * the First Capital Bank sponsor logo. If the league admin sets a
 * custom logo in Settings, that one rotates with the sponsor logo
 * instead of the crest.
 */
export default function LeagueLogo({ size = 32, rounded = 2, sx = {} }) {
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
    // Matches the 5s revolution period, so the swap lands exactly when
    // the globe is facing the viewer again.
    const id = setInterval(() => {
      setShowSponsor((s) => !s);
    }, SWAP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Box sx={{ perspective: 500, width: size, height: size, flexShrink: 0, ...sx }}>
      <Box
        component="img"
        src={showSponsor ? fcbUrl : base}
        alt="League logo"
        draggable={false}
        sx={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          bgcolor: '#ffffff',
          borderRadius: rounded,
          display: 'block',
          transformStyle: 'preserve-3d',
          animation: 'logo-globe 5s linear infinite, logo-glow 2.5s ease-in-out infinite',
        }}
      />
    </Box>
  );
}
