import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import logoUrl from '../assets/bdyfc-logo.png';
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
 * The league logo — used everywhere the league "ball" used to stand.
 * The league admin can set a custom logo in League Settings; until then
 * (or if removed) the official BDYFC crest is shown.
 */
export default function LeagueLogo({ size = 32, rounded = 2, sx = {} }) {
  const [src, setSrc] = useState(logoUrl);

  useEffect(() => {
    let on = true;
    fetchCustomLogo().then((url) => {
      if (on && url) setSrc(url);
    });
    return () => {
      on = false;
    };
  }, []);

  return (
    <Box
      component="img"
      src={src}
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
        ...sx,
      }}
    />
  );
}
