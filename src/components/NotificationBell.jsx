import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/standings';
import supabase from '../lib/supabase';

export default function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

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
    setItems(res.data || []);
    setUnread(cnt.count || 0);
  }, [profile?.id]);

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

  return (
    <>
      <IconButton onClick={openMenu} size="small" aria-label="Notifications" sx={{ color: 'text.secondary' }}>
        <Badge badgeContent={unread} max={99} color="primary" sx={{ '& .MuiBadge-badge': { bgcolor: 'primary.main', color: '#04120a' } }}>
          <NotificationsNoneRounded />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        slotProps={{
          paper: { width: 380, maxWidth: '92vw', maxHeight: '70vh', overflowY: 'auto' },
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
    </>
  );
}
