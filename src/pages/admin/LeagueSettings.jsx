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
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import InputBase from '@mui/material/InputBase';
import supabase from '../../lib/supabase';
import defaultLogo from '../../assets/bdyfc-logo.png';

export default function LeagueSettings() {
  const [leagueName, setLeagueName] = useState('');
  const [season, setSeason] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase.from('league_settings').select('key, value').then(({ data }) => {
      (data || []).forEach((row) => {
        if (row.key === 'league_name') setLeagueName(row.value || '');
        if (row.key === 'season') setSeason(row.value || '');
        if (row.key === 'logo_url') setLogoUrl(row.value || '');
      });
      setLoaded(true);
    });
  }, []);

  const saveLogo = async (e) => {
    e.preventDefault();
    const f = logoFile;
    if (!f) return;
    if (f.size > 1024 * 1024) {
      setMessage({ severity: 'error', text: 'Logo must be 1MB or smaller.' });
      return;
    }
    setBusy(true);
    const ext = (f.name.split('.').pop() || 'png').toLowerCase();
    const path = `logo_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('app-assets').upload(path, f, { contentType: f.type });
    if (upErr) {
      setBusy(false);
      setMessage({ severity: 'error', text: upErr.message });
      return;
    }
    const { data: pub } = supabase.storage.from('app-assets').getPublicUrl(path);
    const { error: setErr } = await supabase.from('league_settings').upsert(
      { key: 'logo_url', value: pub.publicUrl },
      { onConflict: 'key' }
    );
    if (setErr) {
      setBusy(false);
      setMessage({ severity: 'error', text: setErr.message });
      return;
    }
    if (logoUrl) {
      const oldPath = logoUrl.split('/app-assets/')[1];
      if (oldPath) supabase.storage.from('app-assets').remove([decodeURIComponent(oldPath)]);
    }
    setLogoUrl(pub.publicUrl);
    setLogoFile(null);
    setBusy(false);
    setMessage({ severity: 'success', text: 'Logo saved — it now shows across the whole app.' });
  };

  const removeLogo = async () => {
    if (!window.confirm('Remove the custom logo? The standard crest will be used again.')) return;
    if (logoUrl) {
      const oldPath = logoUrl.split('/app-assets/')[1];
      if (oldPath) supabase.storage.from('app-assets').remove([decodeURIComponent(oldPath)]);
    }
    const { error } = await supabase.from('league_settings').upsert(
      { key: 'logo_url', value: '' },
      { onConflict: 'key' }
    );
    if (error) setMessage({ severity: 'error', text: error.message });
    else {
      setLogoUrl('');
      setMessage({ severity: 'success', text: 'Logo removed — standard crest restored.' });
    }
  };

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

      <GlassCard title="League logo" sx={{ mt: 3 }}>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box
            component="img"
            src={logoUrl || defaultLogo}
            sx={{
              width: 96,
              height: 96,
              objectFit: 'contain',
              bgcolor: '#ffffff',
              borderRadius: 3,
              border: '1px solid',
              borderColor: 'cardBorder',
              flexShrink: 0,
            }}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: '1 1 260px', minWidth: 240 }}>
            <Typography variant="body2" color="text.secondary">
              The logo shown everywhere in the app — the top bar, the landing page, match cards. Square images look best.
            </Typography>
            <InputBase
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              sx={{ fontSize: 13 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" startIcon={<SaveRounded />} disabled={!logoFile || busy} onClick={saveLogo}>
                {busy ? 'Saving…' : 'Save logo'}
              </Button>
              {logoUrl && (
                <Button variant="outlined" color="error" startIcon={<DeleteRounded />} onClick={removeLogo}>
                  Remove
                </Button>
              )}
            </Box>
          </Box>
        </Box>
      </GlassCard>
    </div>
  );
}
