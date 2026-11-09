import React, { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteRounded from '@mui/icons-material/DeleteRounded';
import FavoriteRounded from '@mui/icons-material/FavoriteRounded';
import FavoriteBorderRounded from '@mui/icons-material/FavoriteBorderRounded';
import CommentRounded from '@mui/icons-material/CommentRounded';
import CardGiftcardRounded from '@mui/icons-material/CardGiftcardRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import VideocamRounded from '@mui/icons-material/VideocamRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import InsertEmoticonRounded from '@mui/icons-material/InsertEmoticonRounded';
import MicRounded from '@mui/icons-material/MicRounded';
import FiberManualRecordRounded from '@mui/icons-material/FiberManualRecordRounded';
import CancelRounded from '@mui/icons-material/CancelRounded';
import supabase from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import timeAgo from '../../utils/timeAgo';

const ROLE_LABEL = {
  admin: 'League Admin',
  commissioner: 'Commissioner',
  manager: 'Manager',
  player: 'Player',
  editor: 'Editor',
  fan: 'Fan',
};

const GIFTS = [
  { type: 'ball', emoji: '⚽', name: 'Ball', cost: 50 },
  { type: 'fire', emoji: '🔥', name: 'Fire', cost: 100 },
  { type: 'star', emoji: '⭐', name: 'Star', cost: 250 },
  { type: 'trophy', emoji: '🏆', name: 'Trophy', cost: 500 },
];

const MAX_BYTES = 40 * 1024 * 1024; // 40 MB

const RX_KINDS = [
  { kind: 'sticker', label: 'Sticker', emoji: '🎭', accept: 'image/*', max: 4 * 1024 * 1024 },
  { kind: 'meme', label: 'Meme', emoji: '😂', accept: 'image/*', max: 8 * 1024 * 1024 },
  { kind: 'photo', label: 'Photo', emoji: '📷', accept: 'image/*', max: 8 * 1024 * 1024 },
  { kind: 'video', label: 'Short video', emoji: '🎬', accept: 'video/*', max: 20 * 1024 * 1024 },
];

export default function SocialFeed() {
  const { profile } = useAuth();
  const me = profile?.id;

  const [posts, setPosts] = useState([]);
  const [likeCounts, setLikeCounts] = useState({});
  const [myLikes, setMyLikes] = useState({});
  const [commentsByPost, setCommentsByPost] = useState({});
  const [openComments, setOpenComments] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [points, setPoints] = useState(null);
  const [reactionsByPost, setReactionsByPost] = useState({});

  // composer
  const [body, setBody] = useState('');
  const [media, setMedia] = useState(null); // { url, type }
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileRef = useRef(null);
  const [fileKind, setFileKind] = useState('image');

  // gifts
  const [giftTarget, setGiftTarget] = useState(null);
  const [giftType, setGiftType] = useState('ball');
  const [giftMsg, setGiftMsg] = useState('');
  const [giftBusy, setGiftBusy] = useState(false);
  const [snack, setSnack] = useState(null);

  const load = useCallback(async () => {
    if (!me) return;
    const { data, error: pErr } = await supabase
      .from('posts')
      .select('*, profiles!posts_user_id_fkey(full_name, role)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (pErr) {
      setError(pErr.message);
      setLoading(false);
      return;
    }
    const list = data || [];
    setPosts(list);
    setLoading(false);

    if (!list.length) {
      setLikeCounts({});
      setMyLikes({});
      setCommentsByPost({});
      setReactionsByPost({});
      return;
    }
    const ids = list.map((p) => p.id);
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', ids);
    const { data: comments } = await supabase
      .from('post_comments')
      .select('id, post_id, body, created_at, media_url, media_type, profiles!post_comments_user_id_fkey(full_name)')
      .in('post_id', ids)
      .order('created_at', { ascending: true });
    const { data: reactions } = await supabase
      .from('post_reactions')
      .select('id, post_id, user_id, kind, media_url, created_at, profiles!post_reactions_user_id_fkey(full_name)')
      .in('post_id', ids)
      .order('created_at', { ascending: true });

    const counts = {};
    const mine = {};
    (likes || []).forEach((l) => {
      counts[l.post_id] = (counts[l.post_id] || 0) + 1;
      if (l.user_id === me) mine[l.post_id] = true;
    });
    setLikeCounts(counts);
    setMyLikes(mine);

    const byPost = {};
    (comments || []).forEach((c) => {
      if (!byPost[c.post_id]) byPost[c.post_id] = [];
      byPost[c.post_id].push(c);
    });
    setCommentsByPost(byPost);

    const rxByPost = {};
    (reactions || []).forEach((r) => {
      if (!rxByPost[r.post_id]) rxByPost[r.post_id] = [];
      rxByPost[r.post_id].push(r);
    });
    setReactionsByPost(rxByPost);
  }, [me]);

  useEffect(() => {
    if (!me) return undefined;
    load();
    supabase
      .from('profiles')
      .select('points')
      .eq('id', me)
      .maybeSingle()
      .then(({ data }) => setPoints(data?.points ?? 0));
    const id = setInterval(load, 30000);
    const channel = supabase
      .channel('social-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => load())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_reactions' },
        () => load()
      )
      .subscribe();
    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [load, me]);

  const pickFile = (kind) => {
    setFileKind(kind);
    fileRef.current?.click();
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_BYTES) {
      setSnack({ severity: 'error', text: 'Too big — max 40 MB.' });
      return;
    }
    const ext = (f.name.split('.').pop() || (fileKind === 'image' ? 'jpg' : 'mp4')).toLowerCase();
    setUploading(true);
    const path = `${me}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('social-media')
      .upload(path, f);
    setUploading(false);
    if (upErr) {
      setSnack({ severity: 'error', text: upErr.message });
      return;
    }
    const { data } = supabase.storage.from('social-media').getPublicUrl(path);
    setMedia({ url: data.publicUrl, type: fileKind });
  };

  const post = async () => {
    if ((!body.trim() && !media) || uploading || posting) return;
    setPosting(true);
    const { error: insErr } = await supabase.from('posts').insert({
      user_id: me,
      body: body.trim() || null,
      media_url: media?.url || null,
      media_type: media?.type || null,
    });
    setPosting(false);
    if (insErr) {
      setSnack({ severity: 'error', text: insErr.message });
      return;
    }
    setBody('');
    setMedia(null);
    load();
  };

  const toggleLike = async (postId) => {
    if (myLikes[postId]) {
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', me);
      setMyLikes((m) => ({ ...m, [postId]: false }));
      setLikeCounts((c) => ({ ...c, [postId]: Math.max(0, (c[postId] || 1) - 1) }));
    } else {
      const { error: lErr } = await supabase
        .from('post_likes')
        .insert({ post_id: postId, user_id: me });
      if (lErr) return;
      setMyLikes((m) => ({ ...m, [postId]: true }));
      setLikeCounts((c) => ({ ...c, [postId]: (c[postId] || 0) + 1 }));
    }
  };

  const addComment = async (postId, text, voiceUrl) => {
    const { error: cErr } = await supabase
      .from('post_comments')
      .insert({
        post_id: postId,
        user_id: me,
        body: text ? text.trim() : null,
        media_url: voiceUrl || null,
        media_type: voiceUrl ? 'audio' : null,
      });
    if (cErr) setSnack({ severity: 'error', text: cErr.message });
    else load();
  };

  const addReaction = async (postId, kind, url) => {
    const { error: rErr } = await supabase
      .from('post_reactions')
      .upsert({ post_id: postId, user_id: me, kind, media_url: url }, { onConflict: 'post_id,user_id' });
    if (rErr) setSnack({ severity: 'error', text: rErr.message });
    else load();
  };

  const removeReaction = async (postId, userId) => {
    await supabase.from('post_reactions').delete().eq('post_id', postId).eq('user_id', userId);
    load();
  };

  const deletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    await supabase.from('posts').delete().eq('id', postId);
    load();
  };

  const sendGift = async () => {
    const g = GIFTS.find((x) => x.type === giftType);
    if (!g || !giftTarget) return;
    setGiftBusy(true);
    const { error: gErr } = await supabase.from('gifts').insert({
      from_id: me,
      to_id: giftTarget.id,
      gift_type: g.type,
      points: g.cost,
      message: giftMsg.trim() || null,
    });
    setGiftBusy(false);
    if (gErr) {
      setSnack({ severity: 'error', text: gErr.message });
      return;
    }
    setPoints((p) => Math.max(0, (p ?? 0) - g.cost));
    setSnack({ severity: 'success', text: `Gift sent to ${giftTarget.profiles?.full_name || 'them'}!` });
    setGiftTarget(null);
    setGiftMsg('');
  };

  const [drafts, setDrafts] = useState({});

  if (!profile) return null;

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto', py: 2, px: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 900 }}>
          Social
        </Typography>
        <Chip
          icon={<CardGiftcardRounded />}
          label={`${points ?? 0} pts`}
          color="primary"
          variant="filled"
          sx={{ fontWeight: 800 }}
        />
      </Box>

      <input
        ref={fileRef}
        type="file"
        accept={fileKind === 'image' ? 'image/*' : 'video/*'}
        style={{ display: 'none' }}
        onChange={onFile}
      />

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Could not load the feed: {error}
        </Alert>
      )}

      {/* ---------------- feed ---------------- */}
      {loading ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
          Loading…
        </Typography>
      ) : !posts.length ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 6,
            border: 2,
            borderStyle: 'dashed',
            borderColor: 'divider',
            borderRadius: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            Be the first to post
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            Share a message, a photo or a video with the whole league.
          </Typography>
        </Box>
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            meId={me}
            liked={Boolean(myLikes[p.id])}
            likeCount={likeCounts[p.id] || 0}
            comments={commentsByPost[p.id] || []}
            commentsOpen={openComments === p.id}
            onToggleComments={() => setOpenComments(openComments === p.id ? null : p.id)}
            onLike={() => toggleLike(p.id)}
            reactions={reactionsByPost[p.id] || []}
            onReact={(kind, url) => addReaction(p.id, kind, url)}
            onRemoveReaction={(uid) => removeReaction(p.id, uid)}
            onComment={(t, v) => addComment(p.id, t, v)}
            notify={setSnack}
            onGift={() => {
              setGiftTarget(p);
              setGiftType('ball');
              setGiftMsg('');
            }}
            onDelete={() => deletePost(p.id)}
            draft={drafts[p.id] || ''}
            setDraft={(v) => setDrafts((d) => ({ ...d, [p.id]: v }))}
          />
        ))
      )}

      {/* ---------------- composer ---------------- */}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          p: 1.5,
          bgcolor: 'background.paper',
          mt: 2,
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 800 }}>
            {(profile.full_name || profile.email || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          <Box sx={{ flex: 1 }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              placeholder="What's happening in the league?"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 1000))}
              size="small"
            />
            {media && (
              <Box sx={{ position: 'relative', mt: 1, maxWidth: 320 }}>
                {media.type === 'image' ? (
                  <Box component="img" src={media.url} alt="preview" sx={{ maxWidth: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 2 }} />
                ) : (
                  <Box component="video" src={media.url} controls sx={{ maxWidth: '100%', maxHeight: 200, borderRadius: 2 }} />
                )}
                <IconButton
                  size="small"
                  onClick={() => setMedia(null)}
                  sx={{ position: 'absolute', top: 4, right: 4, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff' }}
                >
                  <DeleteRounded fontSize="small" />
                </IconButton>
              </Box>
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
              <Button
                size="small"
                startIcon={<PhotoCameraRounded />}
                onClick={() => pickFile('image')}
                disabled={uploading}
              >
                Photo
              </Button>
              <Button
                size="small"
                startIcon={<VideocamRounded />}
                onClick={() => pickFile('video')}
                disabled={uploading}
              >
                Video
              </Button>
              <Box sx={{ flex: 1 }} />
              <Button
                size="small"
                variant="contained"
                startIcon={<SendRounded />}
                onClick={post}
                disabled={(!body.trim() && !media) || uploading || posting}
              >
                {uploading ? 'Uploading…' : posting ? 'Posting…' : 'Post'}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ---------------- gift dialog ---------------- */}
      <Dialog open={Boolean(giftTarget)} onClose={() => setGiftTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>
          Send a gift to {giftTarget?.profiles?.full_name || '…'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Gifts are paid with your league points — the FCB Bank money wallet plugs in later.
            You have <b>{points ?? 0} pts</b>.
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            {GIFTS.map((g) => (
              <Button
                key={g.type}
                variant={giftType === g.type ? 'contained' : 'outlined'}
                onClick={() => setGiftType(g.type)}
                sx={{ height: 72, flexDirection: 'column', px: 0 }}
              >
                <Box component="span" sx={{ fontSize: 26, lineHeight: 1 }}>
                  {g.emoji}
                </Box>
                <Box component="span" sx={{ fontWeight: 800 }}>
                  {g.name}
                </Box>
                <Box component="span" sx={{ fontSize: 12, opacity: 0.85 }}>
                  {g.cost} pts
                </Box>
              </Button>
            ))}
          </Box>
          <TextField
            label="Add a message (optional)"
            value={giftMsg}
            onChange={(e) => setGiftMsg(e.target.value.slice(0, 200))}
            multiline
            minRows={2}
            fullWidth
            size="small"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGiftTarget(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={sendGift}
            disabled={giftBusy || (points ?? 0) < (GIFTS.find((g) => g.type === giftType)?.cost || 0)}
          >
            {giftBusy ? 'Sending…' : 'Send gift'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={Boolean(snack)} autoHideDuration={4000} onClose={() => setSnack(null)}>
        <Alert onClose={() => setSnack(null)} severity={snack?.severity} variant="filled">
          {snack?.text}
        </Alert>
      </Snackbar>
    </Box>
  );
}

function PostCard({
  post,
  meId,
  liked,
  likeCount,
  comments,
  reactions,
  commentsOpen,
  onToggleComments,
  onLike,
  onReact,
  onRemoveReaction,
  onComment,
  onGift,
  onDelete,
  draft,
  setDraft,
  notify,
}) {
  const name = post.profiles?.full_name || 'Member';
  const isMine = post.user_id === meId;
  const [sending, setSending] = useState(false);

  // ---------- reactions: sticker / meme / photo / short video ----------
  const [rxAnchor, setRxAnchor] = useState(null);
  const [rxKind, setRxKind] = useState('sticker');
  const [rxPending, setRxPending] = useState(null); // { url, kind, label }
  const [rxView, setRxView] = useState(null); // existing reaction lightbox
  const [rxBusy, setRxBusy] = useState(false);
  const rxRef = useRef(null);
  const myReaction = reactions.find((r) => r.user_id === meId);

  const pickReaction = (kind) => {
    setRxKind(kind);
    setRxAnchor(null);
    const spec = RX_KINDS.find((x) => x.kind === kind);
    if (rxRef.current) rxRef.current.accept = spec.accept;
    rxRef.current?.click();
  };

  const onRxFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const spec = RX_KINDS.find((x) => x.kind === rxKind);
    if (f.size > spec.max) {
      notify({ severity: 'error', text: `Too big — max ${Math.round(spec.max / 1024 / 1024)} MB for a ${spec.label.toLowerCase()}.` });
      return;
    }
    setRxBusy(true);
    const ext = (f.name.split('.').pop() || (spec.kind === 'video' ? 'mp4' : 'jpg')).toLowerCase();
    const path = `${meId}/rx-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('social-media')
      .upload(path, f);
    setRxBusy(false);
    if (upErr) {
      notify({ severity: 'error', text: upErr.message });
      return;
    }
    const { data } = supabase.storage.from('social-media').getPublicUrl(path);
    setRxPending({ url: data.publicUrl, kind: spec.kind, label: spec.label });
  };

  const sendReaction = async () => {
    if (!rxPending || rxBusy) return;
    setRxBusy(true);
    await onReact(rxPending.kind, rxPending.url);
    setRxBusy(false);
    setRxPending(null);
  };

  const rxThumb = (url, kind, size) =>
    kind === 'video' ? (
      <Box
        component="video"
        src={url}
        muted
        playsInline
        preload="metadata"
        sx={{ width: size, height: size, objectFit: 'cover', display: 'block' }}
      />
    ) : (
      <Box component="img" src={url} alt="reaction" sx={{ width: size, height: size, objectFit: 'cover', display: 'block' }} />
    );

  // ---------- voice comments ----------
  const [recState, setRecState] = useState('idle'); // idle | recording
  const [recSec, setRecSec] = useState(0);
  const [pendingVoice, setPendingVoice] = useState(null); // uploaded url
  const [recErr, setRecErr] = useState('');
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (recState !== 'recording') return undefined;
    const t = setInterval(() => setRecSec((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [recState]);

  const toggleRec = async () => {
    if (recState === 'recording') {
      recRef.current?.stop();
      return;
    }
    setRecErr('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecErr('Voice recording is not supported in this browser — keep your browser up to date.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime =
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'].find(
          (m) => MediaRecorder.isTypeSupported(m),
        ) || '';
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecState('idle');
        setRecSec(0);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (blob.size < 1000) {
          setRecErr('That was very short — record again.');
          return;
        }
        const ext = ((rec.mimeType || 'audio/webm').split('/')[1] || 'webm').split(';')[0];
        const file = new File([blob], `vc-${Date.now()}.${ext}`, { type: blob.type });
        const path = `${meId}/vc-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('social-media')
          .upload(path, file);
        if (upErr) {
          setRecErr('Could not upload the voice note. Try again.');
          return;
        }
        const { data } = supabase.storage.from('social-media').getPublicUrl(path);
        setPendingVoice(data.publicUrl);
      };
      recRef.current = rec;
      rec.start();
      setPendingVoice(null);
      setRecSec(0);
      setRecState('recording');
    } catch {
      setRecErr('Microphone access was blocked — allow the microphone in your browser settings.');
    }
  };

  const fmtSec = (x) => `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;

  const submit = async () => {
    if ((!draft.trim() && !pendingVoice) || sending || recState === 'recording') return;
    setSending(true);
    await onComment(draft.trim() || null, pendingVoice);
    setDraft('');
    setPendingVoice(null);
    setSending(false);
  };

  return (
    <Box
      sx={{
        border: 1,
        borderColor: 'divider',
        borderRadius: 3,
        bgcolor: 'background.paper',
        p: 1.5,
        mb: 2,
      }}
    >
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
        <Avatar sx={{ width: 40, height: 40, bgcolor: 'primary.main', fontWeight: 800 }}>
          {name.slice(0, 1).toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {ROLE_LABEL[post.profiles?.role] || post.profiles?.role || 'Member'} • {timeAgo(post.created_at)}
          </Typography>
        </Box>
        {isMine && (
          <IconButton size="small" onClick={onDelete} aria-label="Delete post">
            <DeleteRounded fontSize="small" />
          </IconButton>
        )}
      </Box>

      {post.body && (
        <Typography sx={{ mt: 1.2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{post.body}</Typography>
      )}

      {post.media_url &&
        (post.media_type === 'video' ? (
          <Box component="video" src={post.media_url} controls playsInline sx={{ mt: 1.5, maxWidth: '100%', maxHeight: 340, borderRadius: 2, display: 'block' }} />
        ) : (
          <Box component="img" src={post.media_url} alt="post media" sx={{ mt: 1.5, maxWidth: '100%', maxHeight: 340, objectFit: 'cover', borderRadius: 2, display: 'block' }} />
        ))}

      <Divider sx={{ my: 1 }} />

      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        <Button
          size="small"
          color={liked ? 'error' : 'inherit'}
          startIcon={liked ? <FavoriteRounded /> : <FavoriteBorderRounded />}
          onClick={onLike}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {likeCount > 0 ? likeCount : 'Like'}
        </Button>
        <Button
          size="small"
          color={myReaction ? 'primary' : 'inherit'}
          startIcon={<InsertEmoticonRounded />}
          onClick={(e) => setRxAnchor(e.currentTarget)}
          sx={{ textTransform: 'none', fontWeight: 700 }}
          aria-label="React"
        >
          {reactions.length > 0 ? reactions.length : 'React'}
        </Button>
        <Menu anchorEl={rxAnchor} open={Boolean(rxAnchor)} onClose={() => setRxAnchor(null)}>
          {RX_KINDS.map((k) => (
            <MenuItem key={k.kind} dense onClick={() => pickReaction(k.kind)} sx={{ fontSize: 14, fontWeight: 700 }}>
              <Box component="span" sx={{ mr: 1.25, fontSize: 18 }}>
                {k.emoji}
              </Box>
              {k.label}
            </MenuItem>
          ))}
        </Menu>
        <input
          ref={rxRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onRxFile}
          aria-label="Reaction file"
        />
        <Button
          size="small"
          startIcon={<CommentRounded />}
          onClick={onToggleComments}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {comments.length > 0 ? comments.length : 'Comment'}
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button size="small" startIcon={<CardGiftcardRounded />} onClick={onGift} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Gift
        </Button>
      </Box>

      {reactions.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1, alignItems: 'center' }}>
          {reactions.map((r) => (
            <Box
              key={r.id}
              onClick={() => setRxView({ ...r, author: r.profiles?.full_name || 'Member' })}
              title={r.profiles?.full_name || 'Member'}
              sx={{
                position: 'relative',
                borderRadius: 2,
                overflow: 'hidden',
                cursor: 'pointer',
                border: r.user_id === meId ? 2 : 1,
                borderColor: r.user_id === meId ? 'primary.main' : 'divider',
              }}
            >
              {rxThumb(r.media_url, r.kind, 44)}
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">
            {reactions.length === 1 ? '1 reaction' : `${reactions.length} reactions`}
          </Typography>
        </Box>
      )}

      {commentsOpen && (
        <Box sx={{ mt: 1 }}>
          {comments.map((c) => (
            <Box key={c.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', py: 0.5 }}>
              <Avatar sx={{ width: 26, height: 26, bgcolor: 'secondary.main', fontSize: 12, fontWeight: 800 }}>
                {(c.profiles?.full_name || '?').slice(0, 1).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                  {c.profiles?.full_name || 'Member'}
                </Typography>
                {c.media_url && c.media_type === 'audio' && (
                  <Box component="audio" src={c.media_url} controls sx={{ width: '100%', maxWidth: 320, my: 0.5, display: 'block' }} />
                )}
                {c.body && (
                  <Typography variant="body2" sx={{ wordBreak: 'break-word', display: 'inline' }}>
                    {' '}
                    {c.body}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" display="block">
                  {timeAgo(c.created_at)}
                </Typography>
              </Box>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1, mt: 1, alignItems: 'center' }}>
            <TextField
              fullWidth
              size="small"
              placeholder={recState === 'recording' ? 'Recording…' : 'Write a comment or use the mic…'}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <IconButton
              aria-label={recState === 'recording' ? 'Stop recording' : 'Record a voice comment'}
              onClick={toggleRec}
              sx={{
                bgcolor: recState === 'recording' ? 'error.main' : 'action.hover',
                color: recState === 'recording' ? '#fff' : 'primary.main',
                border: 1,
                borderColor: recState === 'recording' ? 'error.main' : 'primary.main',
                '&:hover': { bgcolor: recState === 'recording' ? 'error.dark' : 'action.hover' },
              }}
            >
              {recState === 'recording' ? <FiberManualRecordRounded /> : <MicRounded />}
            </IconButton>
            <Button
              variant="contained"
              size="small"
              onClick={submit}
              disabled={sending || recState === 'recording' || (!draft.trim() && !pendingVoice)}
            >
              Post
            </Button>
          </Box>
          {recState === 'recording' && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
              <FiberManualRecordRounded sx={{ color: 'error.main', fontSize: 14 }} />
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                {fmtSec(recSec)}
              </Typography>
              <Button size="small" color="error" onClick={toggleRec}>
                Stop
              </Button>
            </Box>
          )}
          {pendingVoice && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
              <Box component="audio" src={pendingVoice} controls sx={{ flex: 1, maxWidth: 300, display: 'block' }} />
              <IconButton size="small" aria-label="Discard voice note" onClick={() => setPendingVoice(null)}>
                <CancelRounded fontSize="small" />
              </IconButton>
            </Box>
          )}
          {recErr && <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>{recErr}</Typography>}
        </Box>
      )}

      {/* reaction picked — confirm */}
      <Dialog open={Boolean(rxPending)} onClose={() => setRxPending(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>
          React with this {rxPending?.label.toLowerCase()}?
        </DialogTitle>
        <DialogContent>
          {rxPending?.kind === 'video' ? (
            <Box component="video" src={rxPending?.url || ''} controls playsInline sx={{ width: '100%', maxHeight: 300, borderRadius: 2 }} />
          ) : (
            <Box component="img" src={rxPending?.url || ''} alt="reaction preview" sx={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 2 }} />
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            You can change or remove your reaction any time.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRxPending(null)}>Cancel</Button>
          <Button variant="contained" onClick={sendReaction} disabled={rxBusy}>
            {rxBusy ? 'Posting…' : 'React'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* reaction lightbox */}
      <Dialog open={Boolean(rxView)} onClose={() => setRxView(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: 14, fontWeight: 800 }}>
            {(rxView?.author || '?').slice(0, 1).toUpperCase()}
          </Avatar>
          {rxView?.author}
        </DialogTitle>
        <DialogContent>
          {rxView?.kind === 'video' ? (
            <Box component="video" src={rxView?.media_url || ''} controls playsInline sx={{ width: '100%', maxHeight: 320, borderRadius: 2 }} />
          ) : (
            <Box component="img" src={rxView?.media_url || ''} alt="reaction" sx={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 2 }} />
          )}
        </DialogContent>
        <DialogActions>
          {rxView && rxView.user_id === meId && (
            <Button
              color="error"
              onClick={() => {
                onRemoveReaction(rxView.user_id);
                setRxView(null);
              }}
            >
              Remove my reaction
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={() => setRxView(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
