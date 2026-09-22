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
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

export default function ManageNews() {
  const [articles, setArticles] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    setArticles(data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const { error } = await supabase.from('news').insert({ title, body });
    if (error) setMessage({ severity: 'error', text: error.message });
    else {
      setMessage({ severity: 'success', text: 'Article published.' });
      setTitle('');
      setBody('');
      load();
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    const { error } = await supabase.from('news').delete().eq('id', a.id);
    if (error) setMessage({ severity: 'error', text: error.message });
    else {
      setMessage({ severity: 'success', text: 'Article deleted.' });
      load();
    }
  };

  if (!loaded) return <LoadingSpinner message="Loading news…" />;

  return (
    <div>
      <PageHeader title="Manage News" subtitle="Publish and remove league announcements" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard title="Publish article" sx={{ mb: 3 }}>
        <Box component="form" onSubmit={handlePublish} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField
            label="Article"
            required
            multiline
            minRows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <Box>
            <Button type="submit" variant="contained" startIcon={<AddRounded />}>
              Publish
            </Button>
          </Box>
        </Box>
      </GlassCard>

      <GlassCard title={`Published (${articles.length})`}>
        {articles.length === 0 ? (
          <EmptyState message="No articles yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {articles.map((a) => (
              <Box key={a.id} sx={{ py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography sx={{ fontWeight: 700, flex: 1 }}>{a.title}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(a.created_at)}
                  </Typography>
                  <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => remove(a)}>
                    Delete
                  </Button>
                </Box>
                <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                  {a.body}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>
    </div>
  );
}
