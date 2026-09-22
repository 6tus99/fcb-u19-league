import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import SportsScoreRounded from '@mui/icons-material/SportsScoreRounded';

const Code = ({ children }) => (
  <Typography component="code" sx={{ fontFamily: 'monospace', px: 0.5, py: 0.25, borderRadius: 1, bgcolor: 'rgba(255,255,255,0.08)' }}>
    {children}
  </Typography>
);

export default function SetupScreen() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2 }}>
      <Paper sx={{ p: 4, maxWidth: 680, width: '100%', borderRadius: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <SportsScoreRounded color="primary" sx={{ fontSize: 42 }} />
          <Typography variant="h4">Not connected to a database yet</Typography>
        </Box>
        <Typography color="text.secondary" paragraph>
          This deployment is missing its Supabase credentials. Add these two environment variables, then redeploy:
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              1. <Code>REACT_APP_SUPABASE_URL</Code>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your Supabase project URL — Supabase Dashboard → Project Settings → API
            </Typography>
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
              2. <Code>REACT_APP_SUPABASE_ANON_KEY</Code>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Your Supabase anon/public key (safe to expose — it is protected by row-level security)
            </Typography>
          </Box>
        </Box>
        <Typography variant="body2" color="text.secondary">
          On Vercel: Project → Settings → Environment Variables → add both for Production and Preview → Redeploy.
          Also make sure <Code>supabase/schema.sql</Code> from this repo has been run once in the Supabase SQL editor.
        </Typography>
      </Paper>
    </Box>
  );
}
