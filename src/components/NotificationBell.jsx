import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Badge from '@mui/material/Badge';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Alert from '@mui/material/Alert';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded';
import ExpandLessRounded from '@mui/icons-material/ExpandLessRounded';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import NotificationsNoneRounded from '@mui/icons-material/NotificationsNoneRounded';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../utils/standings';
import { groupNotifications, notificationMatchId } from '../utils/notificationGroups';
import supabase from '../lib/supabase';
import useAutoRefresh from '../hooks/useAutoRefresh';

const PAGE_SIZE = 200;

export default function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [expanded, setExpanded] = useState({});
  const [visibleEvents, setVisibleEvents] = useState({});
  const [matches, setMatches] = useState({});
  const [pages, setPages] = useState(1);
  const [hasOlder, setHasOlder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [marking, setMarking] = useState(false);
  const requestRef = useRef(0);
  const groups = useMemo(() => groupNotifications(items), [items]);

  const load = useCallback(async () => {
    if (!profile?.id) return;
    const request = ++requestRef.current;
    setLoading(true);
    const [responses, count] = await Promise.all([
      Promise.all(Array.from({ length: pages }, (_, page) => supabase.from('notifications')
        .select('*').eq('user_id', profile.id)
        .order('created_at', { ascending: false }).order('id', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1))),
      supabase.from('notifications').select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id).is('read_at', null),
    ]);
    if (request !== requestRef.current) return;
    const failed = responses.find((r) => r.error);
    if (failed || count.error) {
      setError('Could not refresh notifications. Please try again.');
      setLoading(false);
      return;
    }
    const data = responses.flatMap((r) => r.data || []);
    setItems(data);
    setUnread(count.count || 0);
    setHasOlder((responses[responses.length - 1]?.data || []).length === PAGE_SIZE);
    setError('');
    setLoading(false);

    const ids = [...new Set(data.map(notificationMatchId).filter(Boolean))];
    if (!ids.length) return;
    // Chunk IDs to keep REST URLs small, even after loading older history.
    const chunks = Array.from({ length: Math.ceil(ids.length / 60) }, (_, i) => ids.slice(i * 60, (i + 1) * 60));
    const [fixtures, teams] = await Promise.all([
      Promise.all(chunks.map((chunk) => supabase.from('matches')
        .select('id, home_team_id, away_team_id, home_score, away_score, status').in('id', chunk))),
      supabase.from('teams').select('id, name'),
    ]);
    if (request !== requestRef.current) return;
    const names = Object.fromEntries((teams.data || []).map((t) => [t.id, t.name]));
    if (teams.error || fixtures.some((r) => r.error)) return;
    setMatches(Object.fromEntries(fixtures.flatMap((r) => r.data || []).map((m) => [m.id, {
      ...m, title: `${names[m.home_team_id] || 'Home team'} vs ${names[m.away_team_id] || 'Away team'}`,
    }])));
  }, [profile?.id, pages]);

  useEffect(() => {
    setAnchorEl(null);
    setItems([]);
    setUnread(0);
    setExpanded({});
    setVisibleEvents({});
    setMatches({});
    setPages(1);
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) return undefined;
    load();
    const channel = supabase.channel(`notifications-${profile.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, load)
      .subscribe();
    return () => {
      requestRef.current += 1;
      supabase.removeChannel(channel);
    };
  }, [profile?.id, load]);
  useAutoRefresh(load, 30000);

  // Opening the bell is NOT "read all". Only the updates actually opened
  // are marked read. Other matches keep their unread dots and badge count.
  const markRead = async (notifications) => {
    const ids = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (!ids.length || !profile?.id) return true;
    setMarking(true);
    const now = new Date().toISOString();
    const chunks = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, (i + 1) * 100));
    const results = await Promise.all(chunks.map((chunk) => supabase.from('notifications')
      .update({ read_at: now }).eq('user_id', profile.id).in('id', chunk).is('read_at', null)));
    setMarking(false);
    if (results.some((r) => r.error)) {
      setError('Could not mark these updates as read. Please try again.');
      load();
      return false;
    }
    const readIds = new Set(ids);
    setItems((prev) => prev.map((n) => readIds.has(n.id) ? { ...n, read_at: n.read_at || now } : n));
    // Ask the database for the exact count (another device may be reading too).
    load();
    return true;
  };

  const openItem = async (n) => {
    await markRead([n]);
    setAnchorEl(null);
    if (n.link) navigate(n.link);
  };

  const toggleGroup = (group) => {
    const opening = !expanded[group.key];
    setExpanded((prev) => ({ ...prev, [group.key]: opening }));
    if (opening) markRead(group.events.slice(0, visibleEvents[group.key] || 10));
  };

  const eventContent = (n) => (
    <Box sx={{ width: '100%', minWidth: 0 }}>
      <Typography sx={{ fontWeight: n.read_at ? 600 : 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 0.75, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
        {!n.read_at && <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'primary.main', flexShrink: 0 }} />}
        {n.title}
      </Typography>
      {n.body && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{n.body}</Typography>}
      <Typography variant="caption" color="text.secondary">{formatDate(n.created_at, true)}</Typography>
    </Box>
  );

  return (
    <>
      <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" aria-label="Notifications" sx={{ color: 'headerIcon' }}>
        <Badge badgeContent={unread} max={99} color="primary" sx={{ '& .MuiBadge-badge': { bgcolor: 'primary.main', color: '#17276a' } }}>
          <NotificationsNoneRounded />
        </Badge>
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
        slotProps={{ paper: { sx: { width: 380, maxWidth: '92vw', maxHeight: '70vh', overflowY: 'auto', border: '1px solid', borderColor: 'divider' } } }}>
        <Box sx={{ px: 2, py: 1.25, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, flexGrow: 1 }}>Notifications</Typography>
          {unread > 0 && <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>{unread} unread updates</Typography>}
        </Box>
        <Divider />
        {error && <Alert severity="warning" sx={{ m: 1 }} action={<Button size="small" onClick={load}>Retry</Button>}>{error}</Alert>}
        {groups.length === 0 ? (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}><Typography color="text.secondary" variant="body2">{loading ? 'Loading notifications…' : 'No notifications yet. Match updates will be grouped here.'}</Typography></Box>
        ) : groups.map((group) => {
          if (!group.matchId) return <MenuItem key={group.key} onClick={() => openItem(group.latest)} sx={{ px: 2, py: 1.25, bgcolor: group.unread ? 'tint' : 'transparent' }}>{eventContent(group.latest)}</MenuItem>;
          const match = matches[group.matchId];
          const title = match?.title || 'Match updates';
          const show = visibleEvents[group.key] || 10;
          return (
            <Box key={group.key} component="li" sx={{ listStyle: 'none', borderBottom: '1px solid', borderColor: 'divider' }}>
              <Button fullWidth onClick={() => toggleGroup(group)} aria-expanded={Boolean(expanded[group.key])}
                aria-controls={`match-updates-${group.matchId}`} aria-label={`${title}, ${group.events.length} updates`}
                sx={{ px: 2, py: 1.5, gap: 1, textAlign: 'left', justifyContent: 'flex-start', textTransform: 'none', borderRadius: 0, bgcolor: group.unread ? 'tint' : 'transparent', color: 'text.primary' }}>
                <SportsSoccerRounded sx={{ color: 'primary.main', flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: 14, overflowWrap: 'anywhere' }}>{title}</Typography>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'block' }}>
                    {match && match.status !== 'scheduled' ? `${match.home_score} – ${match.away_score} · ${match.status === 'live' ? 'LIVE' : 'Full time'} · ` : ''}
                    {group.events.length} {group.events.length === 1 ? 'update' : 'updates'}{group.unread ? ` · ${group.unread} new` : ''}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12, whiteSpace: 'normal' }}>{group.latest.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatDate(group.latest.created_at, true)}</Typography>
                </Box>
                {expanded[group.key] ? <ExpandLessRounded fontSize="small" /> : <ExpandMoreRounded fontSize="small" />}
              </Button>
              <Collapse in={Boolean(expanded[group.key])} unmountOnExit>
                <Box id={`match-updates-${group.matchId}`} sx={{ px: 1.5, pb: 1.5 }}>
                  <Button fullWidth variant="contained" size="small" sx={{ mb: 1 }} onClick={async () => {
                    await markRead(group.events);
                    setAnchorEl(null);
                    navigate(`/matches/${group.matchId}`);
                  }}>{match?.status === 'finished' ? 'Open match & timeline' : 'Open live match'}</Button>
                  {group.unread > 0 && <Button fullWidth size="small" disabled={marking} onClick={() => markRead(group.events.slice(0, show))}>Mark visible updates read</Button>}
                  {group.events.slice(0, show).map((n) => <Button key={n.id} fullWidth onClick={() => openItem(n)} sx={{ px: 1, py: 1, textAlign: 'left', textTransform: 'none', color: 'text.primary', borderLeft: '2px solid', borderColor: n.read_at ? 'divider' : 'primary.main', borderRadius: 0, bgcolor: n.read_at ? 'transparent' : 'tint' }}>{eventContent(n)}</Button>)}
                  {group.events.length > show && <Button fullWidth size="small" onClick={() => {
                    setVisibleEvents((prev) => ({ ...prev, [group.key]: show + 10 }));
                    markRead(group.events.slice(show, show + 10));
                  }}>Show earlier match updates</Button>}
                </Box>
              </Collapse>
            </Box>
          );
        })}
        {hasOlder && <Box sx={{ px: 2, py: 1 }}><Button fullWidth disabled={loading} onClick={() => setPages((p) => p + 1)}>{loading ? 'Loading…' : 'Load older notifications'}</Button></Box>}
      </Menu>
    </>
  );
}
