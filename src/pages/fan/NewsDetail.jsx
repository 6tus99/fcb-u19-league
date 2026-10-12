import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import MicRounded from '@mui/icons-material/MicRounded';
import StopRounded from '@mui/icons-material/StopRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import EditRounded from '@mui/icons-material/EditRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import GlassCard from '../../components/GlassCard';
import useVoiceRecorder from '../../hooks/useVoiceRecorder';
import { formatDate } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

const REACTIONS = [
  { id: 'like', emoji: '👍', label: 'Like' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'clap', emoji: '👏', label: 'Clap' },
];

const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

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

  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');

  const rec = useVoiceRecorder(60);
  const previewUrl = useMemo(
    () => (rec.blob ? URL.createObjectURL(rec.blob) : null),
    [rec.blob]
  );
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const loadSocial = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase
        .from('news_comments')
        .select('id, body, voice_url, created_at, user_id, profile:profiles!news_comments_user_id_fkey(full_name)')
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
  const myReaction = reactions.find((r) => mine(r))?.reaction || null;

  // ONE reaction per user: tap the same one to remove, a different one to switch.
  const toggleReaction = async (rid) => {
    if (myReaction === rid) {
      await supabase.from('news_reactions').delete().eq('news_id', id).eq('user_id', me.id);
    } else {
      await supabase
        .from('news_reactions')
        .upsert({ news_id: id, user_id: me.id, reaction: rid }, { onConflict: 'news_id,user_id' });
    }
    loadSocial();
  };

  const uploadVoice = async (blob) => {
    const ext = blob.type && blob.type.includes('mp4') ? 'mp4' : 'webm';
    const path = `${me.id}/voice_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('voice-notes')
      .upload(path, blob, { contentType: blob.type || 'audio/webm' });
    if (error) throw new Error(error.message);
    return supabase.storage.from('voice-notes').getPublicUrl(path).data.publicUrl;
  };

  const addComment = async (e) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body && !rec.blob) return;
    setBusy(true);
    try {
      let voiceUrl = null;
      if (rec.blob) voiceUrl = await uploadVoice(rec.blob);
      const { error } = await supabase.from('news_comments').insert({
        news_id: id,
        user_id: me.id,
        body: body || null,
        voice_url: voiceUrl,
      });
      if (error) {
        setMessage({ severity: 'error', text: error.message });
      } else {
        setDraft('');
        rec.clearBlob();
        loadSocial();
      }
    } catch (err) {
      setMessage({ severity: 'error', text: `Voice note could not be saved: ${err.message}` });
    }
    setBusy(false);
  };

  const saveEdit = async (cid) => {
    const body = editDraft.trim();
    if (!body) return;
    const { error } = await supabase
      .from('news_comments')
      .update({ body, updated_at: new Date().toISOString() })
      .eq('id', cid)
      .eq('user_id', me.id);
    if (error) setMessage({ severity: 'error', text: error.message });
    setEditingId(null);
    loadSocial();
  };

  const deleteComment = async (c) => {
    await supabase.from('news_comments').delete().eq('id', c.id).eq('user_id', me.id);
    if (c.voice_url) {
      const path = c.voice_url.split('/voice-notes/')[1];
      if (path) supabase.storage.from('voice-notes').remove([path]);
    }
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

  const startRecording = async () => {
    try {
      await rec.start();
    } catch (err) {
      setMessage({
        severity: 'error',
        text: 'Microphone access is needed for voice notes. Allow it in your browser and try again.',
      });
    }
  };

  const myInitials = (me?.full_name || me?.email || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
            const active = myReaction === r.id;
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
          <Alert severity="info">Comments, reactions and voice notes are being set up — they'll appear here in a moment.</Alert>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Composer */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                  {myInitials}
                </Avatar>
                <TextField
                  fullWidth
                  placeholder="Write a comment, or tap the mic for a voice note…"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  inputProps={{
                    'aria-label': 'Add a comment',
                    maxLength: 500,
                    onKeyDown: (e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        addComment(e);
                      }
                    },
                  }}
                />
                {!rec.recording ? (
                  <IconButton
                    onClick={startRecording}
                    aria-label="Record voice note"
                    title="Record a voice note (up to 60 seconds)"
                    color="secondary"
                    sx={{ mt: 0.5 }}
                  >
                    <MicRounded />
                  </IconButton>
                ) : (
                  <Button
                    onClick={rec.stop}
                    color="error"
                    variant="contained"
                    startIcon={<StopRounded />}
                    sx={{ borderRadius: 999 }}
                  >
                    {fmtClock(rec.seconds)} — Stop
                  </Button>
                )}
                <Button variant="contained" disabled={busy || (!draft.trim() && !rec.blob)} onClick={addComment}>
                  {busy ? 'Posting…' : 'Post'}
                </Button>
              </Box>

              {rec.recording && (
                <Alert
                  severity="error"
                  icon={<CancelRounded />}
                  action={
                    <Button color="inherit" size="small" onClick={rec.cancel}>
                      Discard
                    </Button>
                  }
                  sx={{ borderRadius: 2 }}
                >
                  Recording… {fmtClock(rec.seconds)} / 1:00. Press Stop when you're done.
                </Alert>
              )}

              {!rec.recording && rec.blob && previewUrl && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', pl: 6 }}>
                  <audio controls src={previewUrl} style={{ height: 36, maxWidth: 300 }} />
                  <Button size="small" color="error" startIcon={<CancelRounded />} onClick={rec.clearBlob}>
                    Remove voice note
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    You can also add text before posting.
                  </Typography>
                </Box>
              )}
            </Box>

            {/* List */}
            {comments.length === 0 ? (
              <EmptyState message="No comments yet — write one, or tap the mic and leave a voice note." />
            ) : (
              comments.map((c) => {
                const isEditing = editingId === c.id;
                const initials = (c.profile?.full_name || '?')
                  .split(' ')
                  .filter(Boolean)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                return (
                  <Box key={c.id} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <Avatar sx={{ width: 34, height: 34, bgcolor: 'secondary.main', color: '#1a1200', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                      {initials}
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{c.profile?.full_name || 'Member'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(c.created_at, true)}
                          {c.updated_at ? ' · edited' : ''}
                        </Typography>
                      </Box>

                      {isEditing ? (
                        <Box sx={{ mt: 0.5, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <TextField
                            fullWidth
                            size="small"
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            inputProps={{ 'aria-label': 'Edit comment', maxLength: 500 }}
                            autoFocus
                          />
                          <Button size="small" variant="contained" startIcon={<CheckRounded />} onClick={() => saveEdit(c.id)}>
                            Save
                          </Button>
                          <Button size="small" onClick={() => setEditingId(null)}>
                            Cancel
                          </Button>
                        </Box>
                      ) : (
                        <>
                          {c.body && <Typography sx={{ mt: 0.25, whiteSpace: 'pre-wrap' }}>{c.body}</Typography>}
                          {c.voice_url && (
                            <Box sx={{ mt: 1 }}>
                              <audio controls src={c.voice_url} style={{ height: 36, maxWidth: 340, width: '100%' }} />
                            </Box>
                          )}
                        </>
                      )}
                    </Box>
                    {mine(c) && !isEditing && (
                      <Box sx={{ display: 'flex', gap: 0.25 }}>
                        <IconButton
                          size="small"
                          aria-label="Edit comment"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditDraft(c.body || '');
                          }}
                        >
                          <EditRounded fontSize="small" />
                        </IconButton>
                        <IconButton size="small" color="error" aria-label="Delete comment" onClick={() => deleteComment(c)}>
                          <DeleteOutlineRounded fontSize="small" />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                );
              })
            )}
          </Box>
        )}
      </GlassCard>
    </Box>
  );
}
