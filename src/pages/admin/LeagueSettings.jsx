import React, { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import SaveRounded from '@mui/icons-material/SaveRounded';
import supabase from '../../lib/supabase';

export default function LeagueSettings() {
  const [leagueName, setLeagueName] = useState('');
  const [season, setSeason] = useState('');
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('league_settings').select('key, value').then(({ data }) => {
      (data || []).forEach((row) => {
        if (row.key === 'league_name') setLeagueName(row.value || '');
        if (row.key === 'season') setSeason(row.value || '');
      });
      setLoaded(true);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('league_settings').upsert(
      [
        { key: 'league_name', value: leagueName },
        { key: 'season', value: season },
      ],
      { onConflict: 'key' }
    );
    if (error) setMessage({ severity: 'error', text: error.message });
    else setMessage({ severity: 'success', text: 'Settings saved.' });
  };

  if (!loaded) return <LoadingSpinner message="Loading settings…" />;

  return (
    <div>
      <PageHeader title="League Settings" subtitle="General information shown across the app" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard title="General">
        <Box component="form" onSubmit={handleSave} sx={{ display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 480 }}>
          <TextField
            label="League name"
            required
            value={leagueName}
            onChange={(e) => setLeagueName(e.target.value)}
            helperText="Shown in the top bar and footer"
          />
          <TextField label="Season" value={season} onChange={(e) => setSeason(e.target.value)} helperText="e.g. 2026 Season" />
          <Box>
            <Button type="submit" variant="contained" startIcon={<SaveRounded />}>
              Save settings
            </Button>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Role-based permissions are managed in <strong>Users</strong>. Team, match, news and official management lives on their
            respective pages.
          </Typography>
        </Box>
      </GlassCard>
    </div>
  );
}
