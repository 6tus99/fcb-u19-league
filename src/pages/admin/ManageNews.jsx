import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import AddPhotoAlternateRounded from '@mui/icons-material/AddPhotoAlternateRounded';
import VideocamRounded from '@mui/icons-material/VideocamRounded';
import PollRounded from '@mui/icons-material/PollRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const MAX_IMAGE_MB = 5;
const MAX_VIDEO_MB = 50;

const fmtSize = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;

export default function ManageNews() {
  const { profile: me } = useAuth();
  const [articles, setArticles] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [message, setMessage] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);

  const [imageFile, setImageFile] = useState(null); // { file, url }
  const [videoFile, setVideoFile] = useState(null); // { file, name, size }
  const [pollQ, setPollQ] = useState('');
  const [pollOptions, setPollOptions] = useState([]); // array of strings

  const load = useCallback(async () => {
    const { data } = await supabase.from('news').select('*').order('created_at', { ascending: false });
    setArticles(data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, 30000);

  const pickImage = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) return setMessage({ severity: 'error', text: 'Please choose an image file.' });
    if (f.size > MAX_IMAGE_MB * 1024 * 1024)
      return setMessage({ severity: 'error', text: `Image is too big — keep it under ${MAX_IMAGE_MB} MB.` });
    setImageFile({ file: f, url: URL.createObjectURL(f) });
  };

  const pickVideo = (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('video/')) return setMessage({ severity: 'error', text: 'Please choose a video file.' });
    if (f.size > MAX_VIDEO_MB * 1024 * 1024)
      return setMessage({ severity: 'error', text: `Video is too big — keep it under ${MAX_VIDEO_MB} MB.` });
    setVideoFile({ file: f, name: f.name, size: f.size });
  };

  const uploadMedia = async (file) => {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().slice(0, 5);
    const path = `${me.id}/media_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from('news-media')
      .upload(path, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    return supabase.storage.from('news-media').getPublicUrl(path).data.publicUrl;
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ severity: 'error', text: 'Give the story a title first.' });
      return;
    }
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (pollQ.trim() && options.length < 2) {
      setMessage({ severity: 'error', text: 'A poll needs at least two options (or clear the question to skip the poll).' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        poll_options: pollQ.trim() && options.length >= 2 ? options : null,
      };
      if (imageFile) payload.image_url = await uploadMedia(imageFile.file);
      if (videoFile) payload.video_url = await uploadMedia(videoFile.file);
      const { error } = await supabase.from('news').insert(payload);
      if (error) throw new Error(error.message);
      setMessage({ severity: 'success', text: 'Story published.' });
      setTitle('');
      setBody('');
      setImageFile(null);
      setVideoFile(null);
      setPollQ('');
      setPollOptions([]);
      load();
    } catch (err) {
      setMessage({ severity: 'error', text: `Could not publish: ${err.message}` });
    }
    setBusy(false);
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title}"?`)) return;
    const { error } = await supabase.from('news').delete().eq('id', a.id);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      [a.image_url, a.video_url].forEach((url) => {
        const path = url?.split('/news-media/')[1];
        if (path) supabase.storage.from('news-media').remove([path]);
      });
      setMessage({ severity: 'success', text: 'Article deleted.' });
      load();
    }
  };

  if (!loaded) return <LoadingSpinner message="Loading news…" />;

  return (
    <div>
      <PageHeader title="News Desk" subtitle="Write stories, add pictures or video, and run polls" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard title="Publish a story" sx={{ mb: 3 }} accent="yellow">
        <Box component="form" onSubmit={handlePublish} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <TextField
            label="Story"
            required
            multiline
            minRows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />

          {/* Picture */}
          {imageFile ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Box
                component="img"
                src={imageFile.url}
                sx={{ width: 96, height: 64, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'cardBorder' }}
              />
              <Typography variant="body2" color="text.secondary">
                {imageFile.file.name} ({fmtSize(imageFile.file.size)})
              </Typography>
              <Button size="small" color="error" startIcon={<CloseRounded />} onClick={() => setImageFile(null)}>
                Remove picture
              </Button>
            </Box>
          ) : (
            <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateRounded />}>
              Add a picture (optional, max {MAX_IMAGE_MB} MB)
              <input hidden type="file" accept="image/*" onChange={pickImage} />
            </Button>
          )}

          {/* Video */}
          {videoFile ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <VideocamRounded color="primary" />
              <Typography variant="body2" color="text.secondary">
                {videoFile.name} ({fmtSize(videoFile.size)})
              </Typography>
              <Button size="small" color="error" startIcon={<CloseRounded />} onClick={() => setVideoFile(null)}>
                Remove video
              </Button>
            </Box>
          ) : (
            <Button component="label" variant="outlined" startIcon={<VideocamRounded />}>
              Add a video (optional, max {MAX_VIDEO_MB} MB)
              <input hidden type="file" accept="video/*" onChange={pickVideo} />
            </Button>
          )}

          {/* Poll */}
          <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
              <PollRounded color="primary" fontSize="small" /> Poll (optional)
            </Typography>
            <TextField
              label="Question"
              placeholder="e.g. Who wins Week 4 — CC Stars or Rams United?"
              value={pollQ}
              onChange={(e) => setPollQ(e.target.value)}
            />
            {pollOptions.map((opt, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <TextField
                  size="small"
                  label={`Option ${i + 1}`}
                  value={opt}
                  onChange={(e) =>
                    setPollOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))
                  }
                />
                {pollOptions.length > 2 && (
                  <IconButton
                    size="small"
                    color="error"
                    aria-label={`Remove option ${i + 1}`}
                    onClick={() => setPollOptions((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <CloseRounded fontSize="small" />
                  </IconButton>
                )}
              </Box>
            ))}
            {pollOptions.length < 5 && (
              <Button size="small" startIcon={<AddRounded />} onClick={() => setPollOptions((prev) => [...prev, ''])}>
                Add option
              </Button>
            )}
          </Box>

          <Box>
            <Button type="submit" variant="contained" startIcon={<AddRounded />} disabled={busy}>
              {busy ? 'Publishing…' : 'Publish'}
            </Button>
          </Box>
        </Box>
      </GlassCard>

      <GlassCard title={`Published (${articles.length})`}>
        {articles.length === 0 ? (
          <EmptyState message="No stories yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {articles.map((a) => (
              <Box key={a.id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'cardBorder' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  {a.image_url && (
                    <Box
                      component="img"
                      src={a.image_url}
                      sx={{ width: 56, height: 40, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }}
                    />
                  )}
                  <Typography sx={{ fontWeight: 700, flex: 1, minWidth: 160 }}>{a.title}</Typography>
                  {a.image_url && <Typography variant="caption" color="text.secondary">📷 picture</Typography>}
                  {a.video_url && <Typography variant="caption" color="text.secondary">▶ video</Typography>}
                  {a.poll_options?.length > 0 && (
                    <Typography variant="caption" color="text.secondary">
                      📊 poll ({a.poll_options.length} options)
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(a.created_at)}
                  </Typography>
                  <Button size="small" color="error" startIcon={<DeleteRounded />} onClick={() => remove(a)}>
                    Delete
                  </Button>
                </Box>
                {a.body && (
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.5 }}>
                    {a.body}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
        )}
      </GlassCard>
    </div>
  );
}
