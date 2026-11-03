import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Slide from '@mui/material/Slide';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/standings';
import supabase from '../lib/supabase';
import useAutoRefresh from '../hooks/useAutoRefresh';

export default function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [peek, setPeek] = useState(null);
  const knownIdsRef = useRef(null);
  const peekTimerRef = useRef(null);
  const bellRef = useRef(null);

  const showPeek = useCallback((item) => {
    setPeek(item);
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    peekTimerRef.current = setTimeout(() => setPeek(null), 6000);
  }, []);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const [res, cnt] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).is('read_at', null),
    ]);
    const data = res.data || [];
    setItems(data);
    setUnread(cnt.count || 0);
    // First load just learns the existing ids (no pop-out). Anything NEW
    // after that pops out from the bell, shows for 6 s, then slides back.
    const fresh = data.filter((n) => !knownIdsRef.current || !knownIdsRef.current.has(n.id));
    if (!knownIdsRef.current) {
      knownIdsRef.current = new Set(data.map((n) => n.id));
    } else if (fresh.length > 0) {
      fresh.forEach((n) => knownIdsRef.current.add(n.id));
      showPeek(fresh[0]);
    }
  }, [profile?.id, showPeek]);

  useEffect(() => {
    // new login / different user → forget the old id set
    knownIdsRef.current = null;
  }, [profile?.id]);

  useEffect(() => () => {
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
  }, []);

  useEffect(() => {
    if (!profile?.id) return undefined;
    load();
    const channel = supabase
      .channel(`notifications-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);
  useAutoRefresh(load, 30000);

  const openMenu = async (e) => {
    setAnchorEl(e.currentTarget);
    if (unread > 0 && profile?.id) {
      const now = new Date().toISOString();
      await supabase.from('notifications').update({ read_at: now }).is('read_at', null);
      setUnread(0);
      setItems((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    }
  };

  const openItem = (link) => {
    setAnchorEl(null);
    if (link) navigate(link);
  };

  // Tap the pop-out card: mark read + jump to it (or open the full list).
  const peekOpen = async () => {
    const item = peek;
    setPeek(null);
    if (peekTimerRef.current) clearTimeout(peekTimerRef.current);
    if (item?.id && profile?.id) {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', item.id);
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n)));
      setUnread((u) => Math.max(0, u - 1));
    }
    if (item?.link) navigate(item.link);
    else setAnchorEl(bellRef.current);
  };

  return (
    <>
      <IconButton ref={bellRef} onClick={openMenu} size="small" aria-label="Notifications" sx={{ color: 'headerIcon' }}>
        <Badge badgeContent={unread} max={99} color="primary" sx={{ '& .MuiBadge-badge': { bgcolor: 'primary.main', color: '#04120a' } }}>
          <NotificationsNoneRounded />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: {
            width: 380,
            maxWidth: '92vw',
            maxHeight: '70vh',
            overflowY: 'auto',
            border: '1px solid',
            borderColor: (t) => (t.palette.mode === 'dark' ? '#60a5fa' : '#1e3a8a'),
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, flexGrow: 1 }}>
            Notifications
          </Typography>
          {unread > 0 && (
            <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
              {unread} new
            </Typography>
          )}
        </Box>
        <Divider />
        {items.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">
              No notifications yet. Updates about your team and requests will appear here.
            </Typography>
          </Box>
        ) : (
          items.map((n) => (
            <MenuItem
              key={n.id}
              onClick={() => openItem(n.link)}
              sx={{
                px: 2,
                py: 1.25,
                opacity: n.read_at ? 0.72 : 1,
                bgcolor: n.read_at ? 'transparent' : 'tint',
              }}
            >
              <Box sx={{ width: '100%' }}>
                <Typography
                  sx={{
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                  }}
                >
                  {!n.read_at && (
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />
                  )}
                  {n.title}
                </Typography>
                {n.body && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, pl: n.read_at ? 0 : 1.5 }}>
                    {n.body}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ pl: n.read_at ? 0 : 1.5 }}>
                  {formatDate(n.created_at, true)}
                </Typography>
              </Box>
            </MenuItem>
          ))
        )}
      </Menu>

      {/* Pop-out peek: new notification slides out from the bell, shows for
          6 seconds, then slides back in. Tap to open it. */}
      <Slide in={Boolean(peek)} direction="down" mountOnEnter unmountOnExit>
        <Box
          onClick={peekOpen}
          sx={{
            position: 'fixed',
            top: 72,
            right: 12,
            zIndex: 1400,
            width: 340,
            maxWidth: 'calc(100vw - 24px)',
            cursor: 'pointer',
          }}
        >
          <Paper
            elevation={10}
            sx={{
              border: '1px solid',
              borderColor: (t) => (t.palette.mode === 'dark' ? '#60a5fa' : '#1e3a8a'),
              borderRadius: 3,
              p: 1.5,
              display: 'flex',
              gap: 1.25,
              alignItems: 'flex-start',
              boxShadow: (t) => (t.palette.mode === 'dark' ? '0 10px 30px rgba(2,6,23,0.7)' : '0 10px 30px rgba(30,58,138,0.25)'),
            }}
          >
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                bgcolor: 'primary.main',
                color: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <NotificationsNoneRounded fontSize="small" />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: 14 }} noWrap>
                {peek.title}
              </Typography>
              {peek.body && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mt: 0.25,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {peek.body}
                </Typography>
              )}
              <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, mt: 0.5, display: 'block' }}>
                Tap to open
              </Typography>
            </Box>
          </Paper>
        </Box>
      </Slide>
    </>
  );
}
