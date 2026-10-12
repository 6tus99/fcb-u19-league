import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import ShareRounded from '@mui/icons-material/ShareRounded';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import GlassCard from '../../components/GlassCard';
import { formatDate } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

const REACTIONS = [
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'clap', emoji: '👏', label: 'Clap' },
];

export default function NewsDetail() {
  const { id } = useParams();
  const { profile: me } = useAuth();
  const [article, setArticle] = useState(null);
  const [loaded, setLoaded] = useState(false);

  const [comments, setComments] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [socialReady, setSocialReady] = useState(true);

  const loadSocial = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase
        .from('news_comments')
        .select('id, body, created_at, user_id, profile:profiles!news_comments_user_id_fkey(full_name)')
        .eq('news_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('news_reactions').select('id, reaction, user_id').eq('news_id', id),
    ]);
    if (c.error) {
      setSocialReady(false); // tables not migrated yet
    } else {
      setComments(c.data || []);
      setReactions(r.data || []);
    }
  }, [id]);

  useEffect(() => {
    supabase.from('news').select('*').eq('id', id).maybeSingle().then(({ data }) => {
      setArticle(data);
      setLoaded(true);
    });
  }, [id]);

  useEffect(() => {
    loadSocial();
  }, [loadSocial]);

  if (!loaded) return <LoadingSpinner message="Loading article…" />;
  if (!article) return <EmptyState message="Article not found." />;

  const mine = (row) => row.user_id === me?.id;
  const countOf = (rid) => reactions.filter((r) => r.reaction === rid).length;
  const iReacted = (rid) => reactions.some((r) => r.reaction === rid && mine(r));

  const toggleReaction = async (rid) => {
    if (iReacted(rid)) {
      await supabase.from('news_reactions').delete().eq('news_id', id).eq('reaction', rid).eq('user_id', me.id);
    } else {
      await supabase.from('news_reactions').insert({ news_id: id, user_id: me.id, reaction: rid });
    }
    loadSocial();
  };

  const addComment = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    const { error } = await supabase.from('news_comments').insert({ news_id: id, user_id: me.id, body });
    setBusy(false);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      setDraft('');
      loadSocial();
    }
  };

  const deleteComment = async (cid) => {
    await supabase.from('news_comments').delete().eq('id', cid).eq('user_id', me.id);
    loadSocial();
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage({ severity: 'success', text: 'Article link copied — paste it anywhere to share.' });
    } catch (err) {
      setMessage({ severity: 'error', text: 'Could not copy the link. Copy it from the address bar instead.' });
    }
  };

  return (
    <Box>
      <Link component={RouterLink} to="/news" variant="body2" sx={{ fontWeight: 600 }}>
        ← All news
      </Link>

      {/* The post */}
      <Paper sx={{ mt: 1.5, p: { xs: 3, md: 5 }, borderRadius: 3, border: '1px solid', borderColor: 'cardBorder', bgcolor: 'tint' }}>
        <Typography variant="h4">{article.title}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          {formatDate(article.created_at)}
        </Typography>
        <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{article.body}</Typography>

        <Box sx={{ display: 'flex', gap: 1, mt: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          {REACTIONS.map((r) => {
            const active = iReacted(r.id);
            return (
              <Button
                key={r.id}
                onClick={() => toggleReaction(r.id)}
                size="small"
                startIcon={<span sx={{ fontSize: 16 }}>{r.emoji}</span>}
                sx={{
                  borderRadius: 999,
                  fontWeight: 700,
                  border: '1.5px solid',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? 'rgba(22, 163, 74, 0.12)' : 'transparent',
                  color: active ? 'primary.main' : 'text.secondary',
                }}
              >
                {r.label} · {countOf(r.id)}
              </Button>
            );
          })}
          <Box sx={{ flex: 1 }} />
          <Button onClick={share} size="small" startIcon={<ShareRounded />} variant="outlined" sx={{ borderRadius: 999, fontWeight: 700 }}>
            Share
          </Button>
        </Box>
      </Paper>

      {message && (
        <Alert severity={message.severity} sx={{ mt: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      {/* Comments */}
      <GlassCard title={`Comments (${comments.length})`} sx={{ mt: 3 }} accent="blue">
        {!socialReady ? (
          <Alert severity="info">Comments and reactions are being set up — they'll appear here in a moment.</Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box component="form" onSubmit={addComment} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                {(me?.full_name || me?.email || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </Avatar>
              <TextField
                fullWidth
                placeholder="Add a comment…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                inputProps={{ 'aria-label': 'Add a comment', maxLength: 500 }}
                sx={{ minWidth: 220 }}
              />
              <Button type="submit" variant="contained" disabled={busy || !draft.trim()}>
                Post
              </Button>
            </Box>

            {comments.length === 0 ? (
              <EmptyState message="No comments yet — be the first to react to the story." />
            ) : (
              comments.map((c) => (
                <Box key={c.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', color: '#1a1200', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                    {(c.profile?.full_name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{c.profile?.full_name || 'Member'}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(c.created_at, true)}
                      </Typography>
                    </Box>
                    <Typography sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{c.body}</Typography>
                  </Box>
                  {mine(c) && (
                    <IconButton size="small" color="error" aria-label="Delete comment" onClick={() => deleteComment(c.id)}>
                      <DeleteOutlineRounded fontSize="small" />
                    </IconButton>
                  )}
                </Box>
              ))
            )}
          </Box>
        )}
      </GlassCard>
    </Box>
  );
}
