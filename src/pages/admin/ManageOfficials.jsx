import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import supabase from '../../lib/supabase';

const EMPTY = { name: '', type: 'referee', phone: '' };

export default function ManageOfficials() {
  const [officials, setOfficials] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('officials').select('*').order('name');
    setOfficials(data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const { error } = await supabase.from('officials').insert({
      name: form.name,
      type: form.type,
      phone: form.phone || null,
    });
    if (error) setMessage({ severity: 'error', text: error.message });
    else {
      setMessage({ severity: 'success', text: 'Official added.' });
      setForm(EMPTY);
      load();
    }
  };

  const remove = async (o) => {
    if (!window.confirm(`Remove ${o.name}?`)) return;
    const { error } = await supabase.from('officials').delete().eq('id', o.id);
    if (error) setMessage({ severity: 'error', text: error.message });
    else {
      setMessage({ severity: 'success', text: 'Official removed.' });
      load();
    }
  };

  if (!loaded) return <LoadingSpinner message="Loading officials…" />;

  return (
    <div>
      <PageHeader title="Manage Officials" subtitle="Referees and assistant referees" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard title="Add official" sx={{ mb: 3 }}>
        <Box component="form" onSubmit={handleAdd} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr auto' }, alignItems: 'center' }}>
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Type" select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <MenuItem value="referee">Referee</MenuItem>
            <MenuItem value="assistant_referee">Assistant referee</MenuItem>
          </TextField>
          <TextField label="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Button type="submit" variant="contained" startIcon={<AddRounded />}>
            Add
          </Button>
        </Box>
      </GlassCard>

      <GlassCard title={`Officials (${officials.length})`}>
        {officials.length === 0 ? (
          <EmptyState message="No officials yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {officials.map((o) => (
              <Box key={o.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: o.type === 'referee' ? '#4ade80' : '#38bdf8' }} />
                <Typography sx={{ fontWeight: 700, flex: 1 }}>{o.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                  {o.type.replace('_', ' ')}
                </Typography>
                {o.phone && (
                  <Typography variant="body2" color="text.secondary">
                    {o.phone}
                  </Typography>
                )}
                <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => remove(o)}>
                  Remove
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>
    </div>
  );
}
