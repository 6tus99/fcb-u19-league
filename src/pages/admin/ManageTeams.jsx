import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import AddRounded from '@mui/icons-material/AddRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import { readableTextOn } from '../../utils/standings';
import supabase from '../../lib/supabase';

const EMPTY = { name: '', short_name: '', city: '', stadium: '', primary_color: '#3b82f6', secondary_color: '#ffffff' };

export default function ManageTeams() {
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([supabase.from('teams').select('*').order('name'), supabase.from('matches').select('home_team_id, away_team_id')]);
    setTeams(t.data || []);
    setMatches(m.data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reset = () => {
    setForm(EMPTY);
    setEditingId(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      const { error } = await supabase.from('teams').update(form).eq('id', editingId);
      if (error) setMessage({ severity: 'error', text: error.message });
      else setMessage({ severity: 'success', text: 'Team updated.' });
    } else {
      const { error } = await supabase.from('teams').insert(form);
      if (error) setMessage({ severity: 'error', text: error.message });
      else setMessage({ severity: 'success', text: 'Team created.' });
    }
    reset();
    load();
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setForm({
      name: t.name,
      short_name: t.short_name,
      city: t.city || '',
      stadium: t.stadium || '',
      primary_color: t.primary_color,
      secondary_color: t.secondary_color,
    });
  };

  const remove = async (t) => {
    if (!window.confirm(`Delete ${t.name}? This also deletes all its matches.`)) return;
    const { error } = await supabase.from('teams').delete().eq('id', t.id);
    if (error) setMessage({ severity: 'error', text: error.message });
    else setMessage({ severity: 'success', text: 'Team deleted.' });
    reset();
    load();
  };

  if (!loaded) return <LoadingSpinner message="Loading teams…" />;

  const matchCount = (id) => matches.filter((m) => m.home_team_id === id || m.away_team_id === id).length;

  return (
    <div>
      <PageHeader title="Manage Teams" subtitle="Create, edit or remove clubs" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard title={editingId ? 'Edit team' : 'Add team'} sx={{ mb: 3 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, alignItems: 'center' }}>
          <TextField label="Team name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField
            label="Short code (3–4 letters)"
            required
            value={form.short_name}
            onChange={(e) => setForm({ ...form, short_name: e.target.value.toUpperCase() })}
            inputProps={{ maxLength: 4 }}
          />
          <TextField label="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          <TextField label="Stadium / ground" value={form.stadium} onChange={(e) => setForm({ ...form, stadium: e.target.value })} />
          <TextField
            label="Primary colour"
            type="color"
            value={form.primary_color}
            onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
            sx={{ '& input': { padding: 0.5 } }}
          />
          <TextField
            label="Secondary colour"
            type="color"
            value={form.secondary_color}
            onChange={(e) => setForm({ ...form, secondary_color: e.target.value })}
            sx={{ '& input': { padding: 0.5 } }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button type="submit" variant="contained" startIcon={<AddRounded />}>
              {editingId ? 'Save' : 'Add'}
            </Button>
            {editingId && (
              <Button variant="outlined" onClick={reset}>
                Cancel
              </Button>
            )}
          </Box>
        </Box>
      </GlassCard>

      <GlassCard title={`Teams (${teams.length})`}>
        {teams.length === 0 ? (
          <EmptyState message="No teams yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {teams.map((t) => (
              <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
                <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: t.primary_color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontWeight: 900, color: readableTextOn(t.primary_color), fontSize: 12 }}>{t.short_name}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 140 }}>
                  <Typography sx={{ fontWeight: 700 }}>{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.city}{t.stadium ? ` • ${t.stadium}` : ''} • {matchCount(t.id)} matches
                  </Typography>
                </Box>
                <Button size="small" startIcon={<EditRounded />} onClick={() => startEdit(t)}>
                  Edit
                </Button>
                <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => remove(t)}>
                  Delete
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>
    </div>
  );
}
