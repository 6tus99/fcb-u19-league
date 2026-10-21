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
 * Every 5 seconds it swaps with the First Capital Bank sponsor logo:
 * the incoming one spins in while a soft glow pulses (keyframes live
 * in index.css). If the league admin sets a custom logo in Settings,
 * that one rotates with the sponsor logo instead of the crest.
 */
export default function LeagueLogo({ size = 32, rounded = 2, sx = {} }) {
  const [base, setBase] = useState(crestUrl);
  const [showSponsor, setShowSponsor] = useState(false);
  const [spinKey, setSpinKey] = useState(0);

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
    const id = setInterval(() => {
      setShowSponsor((s) => !s);
      setSpinKey((k) => k + 1);
    }, SWAP_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Box
      component="img"
      key={spinKey}
      src={showSponsor ? fcbUrl : base}
      alt="League logo"
      draggable={false}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        bgcolor: '#ffffff',
        borderRadius: rounded,
        display: 'block',
        flexShrink: 0,
        animation: 'logo-spin-swap 0.7s ease, logo-glow 2.5s ease-in-out infinite',
        ...sx,
      }}
    />
  );
}
