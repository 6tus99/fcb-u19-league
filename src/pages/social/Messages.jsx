import React, { useCallback, useEffect, useRef, useState } from 'react';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ArrowBackIosRounded from '@mui/icons-material/ArrowBackIosRounded';
import PhotoCameraRounded from '@mui/icons-material/PhotoCameraRounded';
import SendRounded from '@mui/icons-material/SendRounded';
import PeopleRounded from '@mui/icons-material/PeopleRounded';
import supabase from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import timeAgo from '../../utils/timeAgo';

const ROLE_LABEL = {
  admin: 'League Admin',
  commissioner: 'Commissioner',
  manager: 'Manager',
  player: 'Player',
  editor: 'Editor',
  fan: 'Fan',
};

export default function Messages() {
  const { profile } = useAuth();
  const me = profile?.id;
  const { userId } = useParams();
  const navigate = useNavigate();

  const [convos, setConvos] = useState([]);
  const [thread, setThread] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [picking, setPicking] = useState(false);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  const loadConvos = useCallback(async () => {
    if (!me) return;
    const { data } = await supabase
      .from('messages')
      .select('id, sender_id, recipient_id, body, media_url, media_type, created_at, read_at')
      .or(`sender_id.eq.${me},recipient_id.eq.${me}`)
      .order('created_at', { ascending: false })
      .limit(300);
    const byUser = {};
    (data || []).forEach((m) => {
      const other = m.sender_id === me ? m.recipient_id : m.sender_id;
      if (!byUser[other]) byUser[other] = { user: other, last: m, unread: 0 };
      if (m.recipient_id === me && !m.read_at) byUser[other].unread += 1;
      if (!byUser[other].last || new Date(m.created_at) > new Date(byUser[other].last.created_at)) {
        byUser[other].last = m;
      }
    });
    const ids = Object.keys(byUser);
    if (!ids.length) {
      setConvos([]);
      return;
    }
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, role, email')
      .in('id', ids);
    const nameById = {};
    (users || []).forEach((u) => {
      nameById[u.id] = u;
    });
    setConvos(
      Object.values(byUser)
        .sort((a, b) => new Date(b.last.created_at) - new Date(a.last.created_at))
        .map((c) => ({ ...c, name: nameById[c.user]?.full_name || nameById[c.user]?.email || 'Member' }))
    );
  }, [me]);

  const loadThread = useCallback(
    async (other) => {
      if (!me || !other) return;
      setLoadingThread(true);
      const { data } = await supabase
        .from('messages')
        .select('id, sender_id, recipient_id, body, media_url, media_type, created_at')
        .or(
          `(sender_id.eq.${me}.and.recipient_id.eq.${other}),(sender_id.eq.${other}.and.recipient_id.eq.${me})`
        )
        .order('created_at', { ascending: true })
        .limit(200);
      setThread(data || []);
      setLoadingThread(false);
      // mark their messages to me as read
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_id', me)
        .eq('sender_id', other)
        .is('read_at', null);
      loadConvos();
    },
    [me, loadConvos]
  );

  useEffect(() => {
    if (!me) return undefined;
    loadConvos();
    const channel = supabase
      .channel('messages-app')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${me}` },
        (payload) => {
          loadConvos();
          if (userId && payload.new?.recipient_id === userId) {
            loadThread(userId);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${me}` },
        (payload) => {
          loadConvos();
          if (userId && payload.new?.sender_id === userId) {
            loadThread(userId);
          }
        }
      )
      .subscribe();
    const id = setInterval(loadConvos, 30000);
    return () => {
      clearInterval(id);
      supabase.removeChannel(channel);
    };
  }, [me, loadConvos, userId, loadThread]);

  useEffect(() => {
    if (userId) loadThread(userId);
    else setThread([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [thread.length]);

  const doSearch = async () => {
    if (!me) return;
    const q = search.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .ne('id', me)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    setResults(data || []);
  };

  const send = async () => {
    if (!userId || !text.trim() || busy) return;
    setBusy(true);
    const { error: sErr } = await supabase.from('messages').insert({
      sender_id: me,
      recipient_id: userId,
      body: text.trim(),
    });
    setBusy(false);
    if (sErr) {
      alert(sErr.message);
      return;
    }
    setText('');
    loadThread(userId);
  };

  const onPhoto = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f || !userId) return;
    if (f.size > 10 * 1024 * 1024) {
      alert('Too big — max 10 MB for chat photos.');
      return;
    }
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${me}/${Date.now()}-chat.${ext}`;
    const { error: upErr } = await supabase.storage.from('social-media').upload(path, f);
    if (upErr) {
      alert(upErr.message);
      return;
    }
    const { data } = supabase.storage.from('social-media').getPublicUrl(path);
    const { error: insErr } = await supabase.from('messages').insert({
      sender_id: me,
      recipient_id: userId,
      media_url: data.publicUrl,
      media_type: 'image',
    });
    if (!insErr) loadThread(userId);
  };

  if (!profile) return null;
  const activeC = convos.find((c) => c.user === userId);

  const ConversationList = (
    <Box
      sx={{
        width: { xs: '100%', sm: 300 },
        flexShrink: 0,
        flexDirection: 'column',
        height: '100%',
        borderRight: { sm: 1 },
        borderColor: 'divider',
        display: { xs: userId ? 'none' : 'flex', sm: 'flex' },
      }}
    >
      <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 900, flex: 1 }}>
          Messages
        </Typography>
        <IconButton size="small" onClick={() => setPicking((p) => !p)} aria-label="New message">
          <PeopleRounded />
        </IconButton>
      </Box>
      {picking && (
        <Box sx={{ px: 1.5, pb: 1, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search a member by name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              doSearch();
            }}
          />
          {results.map((r) => (
            <Box
              key={r.id}
              onClick={() => {
                setPicking(false);
                setSearch('');
                setResults([]);
                navigate(`/messages/${r.id}`);
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1,
                py: 0.75,
                borderRadius: 2,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: 14, fontWeight: 800 }}>
                {(r.full_name || r.email || '?').slice(0, 1).toUpperCase()}
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {r.full_name || r.email}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {ROLE_LABEL[r.role] || r.role}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {!convos.length ? (
          <Typography color="text.secondary" sx={{ px: 2, py: 4, textAlign: 'center' }}>
            No conversations yet.
            <br />
            Tap the people icon to start one.
          </Typography>
        ) : (
          convos.map((c) => (
            <Box
              key={c.user}
              onClick={() => navigate(`/messages/${c.user}`)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.2,
                px: 1.5,
                py: 1.2,
                cursor: 'pointer',
                borderLeft: userId === c.user ? 4 : 'none',
                borderLeftColor: 'primary.main',
                bgcolor: userId === c.user ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar sx={{ width: 42, height: 42, bgcolor: 'primary.main', fontWeight: 800 }}>
                {c.name.slice(0, 1).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }} noWrap>
                  {c.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                  {c.last.media_url ? (c.last.media_type === 'video' ? '🎬 Video' : '📷 Photo') : c.last.body || ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  {timeAgo(c.last.created_at)}
                </Typography>
                {c.unread > 0 && (
                  <Chip
                    label={c.unread}
                    size="small"
                    color="primary"
                    sx={{ height: 20, minWidth: 20, fontWeight: 800 }}
                  />
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );

  const ThreadView = (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>
      {!userId ? (
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography color="text.secondary">
            {window.innerWidth >= 600 ? 'Select a conversation to start chatting.' : 'Choose a conversation to start chatting.'}
          </Typography>
        </Box>
      ) : (
        <>
          <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton size="small" onClick={() => navigate('/messages')} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}>
              <ArrowBackIosRounded fontSize="small" />
            </IconButton>
            <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontWeight: 800 }}>
              {(activeC?.name || '?').slice(0, 1).toUpperCase()}
            </Avatar>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }} noWrap>
              {activeC?.name || 'Conversation'}
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 2 }}>
            {loadingThread ? (
              <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                Loading…
              </Typography>
            ) : !thread.length ? (
              <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                Say hello 👋
              </Typography>
            ) : (
              thread.map((m) => {
                const mine = m.sender_id === me;
                return (
                  <Box key={m.id} sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', mb: 1 }}>
                    <Box
                      sx={{
                        maxWidth: '75%',
                        px: 1.5,
                        py: 1,
                        borderRadius: 3,
                        borderBottomRightRadius: mine ? 0.5 : 3,
                        borderBottomLeftRadius: mine ? 3 : 0.5,
                        bgcolor: mine ? 'primary.main' : 'background.default',
                        color: mine ? 'primary.contrastText' : 'text.primary',
                        border: mine ? 'none' : 1,
                        borderColor: 'divider',
                      }}
                    >
                      {m.media_url &&
                        (m.media_type === 'video' ? (
                          <Box component="video" src={m.media_url} controls playsInline sx={{ maxWidth: 240, maxHeight: 240, borderRadius: 1.5, display: 'block', mb: m.body ? 0.5 : 0 }} />
                        ) : (
                          <Box component="img" src={m.media_url} alt="photo" sx={{ maxWidth: 240, maxHeight: 240, borderRadius: 1.5, display: 'block', mb: m.body ? 0.5 : 0 }} />
                        ))}
                      {m.body && <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{m.body}</Typography>}
                      <Typography
                        variant="caption"
                        sx={{ display: 'block', textAlign: 'right', opacity: 0.7, fontSize: 10, mt: 0.3 }}
                      >
                        {timeAgo(m.created_at)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
            <Box ref={bottomRef} />
          </Box>
          <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center' }}>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto} />
            <IconButton onClick={() => fileRef.current?.click()} aria-label="Send photo">
              <PhotoCameraRounded />
            </IconButton>
            <TextField
              fullWidth
              size="small"
              placeholder="Type a message…"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 1000))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  send();
                }
              }}
            />
            <Button variant="contained" startIcon={<SendRounded />} onClick={send} disabled={!text.trim() || busy}>
              Send
            </Button>
          </Box>
        </>
      )}
    </Box>
  );

  return (
    <Box sx={{ height: 'calc(100dvh - 130px)', minHeight: 420 }}>
      <Box sx={{ display: 'flex', height: '100%', border: 1, borderColor: 'divider', borderRadius: 3, overflow: 'hidden', bgcolor: 'background.paper' }}>
        {ConversationList}
        <Box sx={{ display: { xs: userId ? 'flex' : 'none', sm: 'flex' }, flex: 1, minHeight: 0 }}>
          {ThreadView}
        </Box>
      </Box>
    </Box>
  );
}
