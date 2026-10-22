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
      return;
    }
    const ids = list.map((p) => p.id);
    const { data: likes } = await supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', ids);
    const { data: comments } = await supabase
      .from('post_comments')
      .select('id, post_id, body, created_at, profiles!post_comments_user_id_fkey(full_name)')
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

  const addComment = async (postId, text) => {
    const { error: cErr } = await supabase
      .from('post_comments')
      .insert({ post_id: postId, user_id: me, body: text.trim() });
    if (!cErr) load();
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

      {/* ---------------- composer ---------------- */}
      <Box
        sx={{
          border: 1,
          borderColor: 'divider',
          borderRadius: 3,
          p: 1.5,
          bgcolor: 'background.paper',
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
            onComment={(t) => addComment(p.id, t)}
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
  commentsOpen,
  onToggleComments,
  onLike,
  onComment,
  onGift,
  onDelete,
  draft,
  setDraft,
}) {
  const name = post.profiles?.full_name || 'Member';
  const isMine = post.user_id === meId;
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!draft.trim()) return;
    setSending(true);
    await onComment(draft);
    setDraft('');
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

      <Box sx={{ display: 'flex', gap: 0.5 }}>
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
                <Typography variant="body2" sx={{ wordBreak: 'break-word', display: 'inline' }}>
                  {' '}{c.body}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {timeAgo(c.created_at)}
                </Typography>
              </Box>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Write a comment…"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, 500))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
              }}
            />
            <Button variant="contained" size="small" onClick={submit} disabled={!draft.trim() || sending}>
              Post
            </Button>
          </Box>
        </Box>
      )}
    </Box>
  );
}
