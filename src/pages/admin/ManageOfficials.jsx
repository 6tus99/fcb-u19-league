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
import EditRounded from '@mui/icons-material/EditRounded';
import supabase from '../../lib/supabase';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const EMPTY = { name: '', type: 'referee', phone: '', user_id: '' };

export default function ManageOfficials() {
  const [officials, setOfficials] = useState([]);
  const [users, setUsers] = useState([]); // app accounts an official can be linked to
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [o, u] = await Promise.all([
      supabase.from('officials').select('*').order('name'),
      supabase.from('profiles').select('id, full_name, email, role').order('full_name'),
    ]);
    setOfficials(o.data || []);
    setUsers(u.data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, 30000);

  const startEdit = (o) => {
    setForm({ name: o.name, type: o.type, phone: o.phone || '', user_id: o.user_id || '' });
    setEditId(o.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null);
    setForm(EMPTY);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const payload = { name: form.name, type: form.type, phone: form.phone || null, user_id: form.user_id || null };
    if (editId) {
      const { error } = await supabase.from('officials').update(payload).eq('id', editId);
      if (error) setMessage({ severity: 'error', text: error.message });
      else {
        setMessage({ severity: 'success', text: 'Official updated.' });
        cancelEdit();
        load();
      }
      return;
    }
    const { error } = await supabase.from('officials').insert(payload);
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
      <PageHeader title="Manage Officials" subtitle="Referees, assistant referees and the commissioner — these are the people you assign to matches" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard title={editId ? 'Edit official' : 'Add official'} sx={{ mb: 3 }}>
        <Box component="form" onSubmit={handleSave} sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: editId ? '2fr 1fr 1fr 1.5fr auto auto' : '2fr 1fr 1fr 1.5fr auto' }, alignItems: 'center' }}>
          <TextField label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Type" select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <MenuItem value="referee">Referee</MenuItem>
            <MenuItem value="assistant_referee">Assistant referee</MenuItem>
            <MenuItem value="commissioner">Commissioner</MenuItem>
          </TextField>
          <TextField label="Phone (optional)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <TextField
            label="Link to app user (notifications)"
            select
            value={form.user_id}
            onChange={(e) => setForm({ ...form, user_id: e.target.value })}
            helperText="Linked users get a notification when assigned to a match"
          >
            <MenuItem value="">— not linked —</MenuItem>
            {users.map((u) => (
              <MenuItem key={u.id} value={u.id}>
                {u.full_name} ({u.email})
              </MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" startIcon={editId ? <EditRounded /> : <AddRounded />}>
            {editId ? 'Save changes' : 'Add'}
          </Button>
          {editId && (
            <Button onClick={cancelEdit}>Cancel</Button>
          )}
        </Box>
      </GlassCard>

      <GlassCard title={`Officials (${officials.length})`}>
        {officials.length === 0 ? (
          <EmptyState message="No officials yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {officials.map((o) => (
              <Box key={o.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.25, borderBottom: '1px solid', borderColor: 'cardBorder' }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: o.type === 'referee' ? '#4ade80' : o.type === 'commissioner' ? '#fb923c' : '#38bdf8',
                  }}
                />
                <Typography sx={{ fontWeight: 700, flex: 1 }}>{o.name}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                  {o.type.replace('_', ' ')}
                </Typography>
                {o.phone && (
                  <Typography variant="body2" color="text.secondary">
                    {o.phone}
                  </Typography>
                )}
                {o.user_id && (
                  <Typography variant="body2" color="text.secondary">
                    🔔 {users.find((u) => u.id === o.user_id)?.full_name || 'linked user'}
                  </Typography>
                )}
                <Button size="small" startIcon={<EditRounded />} onClick={() => startEdit(o)}>
                  Edit
                </Button>
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
