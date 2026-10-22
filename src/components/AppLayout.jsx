import React, { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import Snackbar from '@mui/material/Snackbar';
import Fab from '@mui/material/Fab';
import CasinoRounded from '@mui/icons-material/CasinoRounded';
import LeagueLogo from './LeagueLogo';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import ArrowBackIosRounded from '@mui/icons-material/ArrowBackIosRounded';
import HomeRounded from '@mui/icons-material/HomeRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import BrightnessAutoRounded from '@mui/icons-material/BrightnessAutoRounded';
import SpaceDashboardRounded from '@mui/icons-material/SpaceDashboardRounded';
import HourglassTopRounded from '@mui/icons-material/HourglassTopRounded';
import { useAuth } from '../context/AuthContext';
import { useThemeMode } from '../context/ThemeContext';
import { homeForRole, dashboardForRole } from './ProtectedRoute';
import NotificationBell from './NotificationBell';
import supabase from '../lib/supabase';

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/requests', label: 'Requests' },
    { to: '/admin/teams', label: 'Teams' },
    { to: '/admin/matches', label: 'Matches' },
    { to: '/admin/news', label: 'News' },
    { to: '/admin/officials', label: 'Officials' },
    { to: '/admin/settings', label: 'Settings' },
  ],
  commissioner: [
    { to: '/commissioner', label: 'Dashboard' },
    { to: '/commissioner/live', label: 'Live Match Control' },
    { to: '/commissioner/matches', label: 'Matches' },
    { to: '/commissioner/events', label: 'Match Events' },
    { to: '/commissioner/reports', label: 'Match Reports' },
    { to: '/standings', label: 'Standings' },
  ],
  manager: [
    { to: '/manager', label: 'My Team' },
    { to: '/manager/matches', label: 'Team Matches' },
    { to: '/standings', label: 'Standings' },
  ],
  player: [
    { to: '/player', label: 'My Team' },
    { to: '/player/matches', label: 'Team Matches' },
    { to: '/standings', label: 'Standings' },
  ],
  editor: [
    { to: '/fan', label: 'Home' },
    { to: '/editor/news', label: 'News Desk' },
  ],
  fan: [
    { to: '/fan', label: 'Home' },
    { to: '/fan/betting', label: 'Betting' },
    { to: '/matches', label: 'Matches' },
    { to: '/standings', label: 'Standings' },
    { to: '/teams', label: 'Teams' },
    { to: '/news', label: 'News' },
  ],
};

const ROLE_LABEL = {
  admin: 'League Admin',
  commissioner: 'Commissioner',
  manager: 'Team Manager',
  player: 'Player',
  editor: 'Editor',
  fan: 'Fan',
};

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const { mode, choice, setChoice } = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [themeAnchor, setThemeAnchor] = useState(null);
  const [leagueName, setLeagueName] = useState('FCB Under 19 Football League');
  const [season, setSeason] = useState('');
  const [pendingChange, setPendingChange] = useState(null);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState(null);

  useEffect(() => {
    supabase.from('league_settings').select('key, value').then(({ data }) => {
      (data || []).forEach((row) => {
        if (row.key === 'league_name' && row.value) setLeagueName(row.value);
        if (row.key === 'season' && row.value) setSeason(row.value);
      });
    });
  }, []);

  // A role upgrade granted by an admin waits here until the user verifies the
  // 6-digit code sent to their phone (multi-authentication step).
  useEffect(() => {
    if (!profile?.id) {
      setPendingChange(null);
      return undefined;
    }
    let active = true;
    supabase
      .from('pending_role_changes')
      .select('id, new_role, phone, expires_at')
      .eq('profile_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (!active) return;
        const row = data?.[0];
        setPendingChange(row && new Date(row.expires_at) > new Date() ? row : null);
      });
    return () => {
      active = false;
    };
  }, [profile?.id]);

  // Live toasts: when a notification arrives while the app is open
  // (match started, goal, foul, substitution, halves, added time,
  // full time…), it pops up here. Realtime is the instant path, with a
  // light poll as a fallback.
  const [toast, setToast] = useState(null);
  const lastNotifRef = useRef(null);

  useEffect(() => {
    if (!profile?.id) return undefined;
    let on = true;
    // Don't toast notifications that arrived before this session opened.
    supabase
      .from('notifications')
      .select('id')
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (on) lastNotifRef.current = data?.[0]?.id || null;
      });
    const channel = supabase
      .channel(`app-toasts-${profile.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` },
        (payload) => {
          lastNotifRef.current = payload.new?.id;
          setToast({ id: payload.new?.id, title: payload.new?.title, body: payload.new?.body, link: payload.new?.link });
        }
      )
      .subscribe();
    const pollId = setInterval(async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, body, link')
        .order('created_at', { ascending: false })
        .limit(1);
      const n = data?.[0];
      if (n && n.id !== lastNotifRef.current) {
        lastNotifRef.current = n.id;
        setToast({ id: n.id, title: n.title, body: n.body, link: n.link });
      }
    }, 20000);
    return () => {
      on = false;
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [profile?.id]);

  const submitVerify = async () => {
    setVerifyBusy(true);
    setVerifyMsg(null);
    const { data, error } = await supabase.functions.invoke('verify-role-code', {
      body: { code: verifyCode.trim() },
    });
    setVerifyBusy(false);
    if (error) {
      // The function may be alive and reporting a specific problem
      // (wrong code, expired, nothing pending) — surface that instead of
      // assuming the whole service is missing.
      let detail = '';
      try {
        if (error.context && typeof error.context.json === 'function') {
          const ctx = await error.context.json();
          detail = (ctx && (ctx.error || ctx.message)) || '';
        }
      } catch {
        /* response was not JSON — fall through to the error message */
      }
      if (!detail) detail = error.message || '';
      if (!detail || /not found/i.test(detail)) {
        setVerifyMsg({
          severity: 'warning',
          text: 'Verification is not set up yet. The admin needs to add the two small Supabase functions (send-role-code and verify-role-code). Your code is stored and will work as soon as that is done.',
        });
      } else {
        setVerifyMsg({ severity: 'error', text: detail });
      }
      return;
    }
    if (data && data.ok) {
      setPendingChange(null);
      setVerifyOpen(false);
      window.location.reload(); // re-fetch the profile so the new role applies
      return;
    }
    setVerifyMsg({ severity: 'error', text: (data && data.error) || 'Verification failed. Try again.' });
  };

  // Layout mode. Everyone lands in the FAN layout after logging in; when
  // they click "My dashboard" (or land directly inside their dashboard
  // area), the layout switches to their ROLE layout and stays there —
  // even while they open shared pages like Standings. The home button
  // takes them back to the fan view.
  const roleAreaPath = profile.role === 'editor' ? '/editor' : dashboardForRole(profile.role);
  const inRoleAreaPath =
    location.pathname === roleAreaPath || location.pathname.startsWith(`${roleAreaPath}/`);
  const [view, setView] = useState(profile.role !== 'fan' && inRoleAreaPath ? 'role' : 'fan');
  const items = view === 'role' ? NAV[profile.role] || NAV.fan : NAV.fan;

  // While the user is inside their own dashboard area, the back arrow in
  // the top-left becomes a HOME button that takes them to the fan view.
  const inRoleArea = profile.role !== 'fan' && inRoleAreaPath;
  const name = profile.full_name || profile.email || '?';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const handleSignOut = async () => {
    setAnchorEl(null);
    await signOut();
    navigate('/login');
  };

  const handleBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate(homeForRole(profile.role));
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'appbar',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.14)',
          color: 'headerText',
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: 64, color: 'inherit' }}>
          <IconButton
            onClick={
              inRoleArea
                ? () => {
                    setView('fan');
                    navigate('/fan');
                  }
                : handleBack
            }
            size="small"
            aria-label={inRoleArea ? 'Go to fan home' : 'Go back'}
            sx={{ color: 'headerIcon', flexShrink: 0 }}
          >
            {inRoleArea ? <HomeRounded sx={{ fontSize: 20 }} /> : <ArrowBackIosRounded sx={{ fontSize: 20 }} />}
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexGrow: 1 }}>
            <LeagueLogo size={34} rounded={1.5} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="subtitle1" noWrap sx={{ fontWeight: 800, lineHeight: 1.15, color: 'headerText' }}>
                {leagueName}
              </Typography>
              <Chip
                label={ROLE_LABEL[profile.role]}
                size="small"
                sx={{ height: 16, fontSize: 9, fontWeight: 700, mt: 0.25, bgcolor: 'rgba(255,255,255,0.16)', color: '#ffffff' }}
              />
            </Box>
          </Box>
          {pendingChange ? (
            <Button
              size="small"
              variant="contained"
              startIcon={<HourglassTopRounded fontSize="small" />}
              onClick={() => {
                setVerifyCode('');
                setVerifyMsg(null);
                setVerifyOpen(true);
              }}
              sx={{
                flexShrink: 0,
                fontWeight: 800,
                bgcolor: '#facc15',
                color: '#1a1a1a',
                '&:hover': { bgcolor: '#eab308' },
              }}
            >
              Verify role
            </Button>
          ) : profile.role !== 'fan' ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<SpaceDashboardRounded fontSize="small" />}
              onClick={() => {
                setView('role');
                navigate(dashboardForRole(profile.role));
              }}
              sx={{
                flexShrink: 0,
                fontWeight: 700,
                color: '#ffffff',
                borderColor: 'rgba(255,255,255,0.55)',
                '&:hover': { borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,0.12)' },
              }}
            >
              My dashboard
            </Button>
          ) : null}
          <IconButton
            onClick={(e) => setThemeAnchor(e.currentTarget)}
            size="small"
            aria-label="Theme settings"
            sx={{ color: 'headerIcon', flexShrink: 0 }}
          >
            {choice === 'system' ? (
              <BrightnessAutoRounded />
            ) : choice === 'dark' ? (
              <DarkModeRounded />
            ) : (
              <LightModeRounded />
            )}
          </IconButton>
          <Menu
            open={Boolean(themeAnchor)}
            anchorEl={themeAnchor}
            onClose={() => setThemeAnchor(null)}
          >
            {[
              { id: 'system', label: 'Match device' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ].map((o) => (
              <MenuItem
                key={o.id}
                selected={o.id === choice}
                onClick={() => {
                  setChoice(o.id);
                  setThemeAnchor(null);
                }}
              >
                {o.label}
              </MenuItem>
            ))}
          </Menu>
          <NotificationBell />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" aria-label="Account menu" sx={{ flexShrink: 0 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', color: '#04120a', fontSize: 13, fontWeight: 800 }}>{initials}</Avatar>
          </IconButton>
        </Toolbar>
        <Toolbar sx={{ gap: 0.5, px: 2, minHeight: 48, overflowX: 'auto', color: 'inherit' }}>
          {items.map((item) => {
            const active =
              location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
            return (
              <ButtonBase
                key={item.to}
                component={RouterLink}
                to={item.to}
                sx={{
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 2,
                  fontSize: 14,
                  fontWeight: active ? 700 : 500,
                  color: active ? '#ffffff' : 'rgba(255,255,255,0.72)',
                  bgcolor: active ? 'rgba(74,222,128,0.22)' : 'transparent',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' },
                }}
              >
                {item.label}
              </ButtonBase>
            );
          })}
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 3, flexGrow: 1 }}>
        <Outlet />
      </Container>

      {/* Floating betting button — follows you down the page */}
      {!location.pathname.startsWith('/fan/betting') && (
        <Fab
          component={RouterLink}
          to="/fan/betting"
          variant="extended"
          aria-label="Betting board"
          title="Betting board (virtual points)"
          sx={{
            position: 'fixed',
            right: { xs: 14, sm: 24 },
            bottom: { xs: 14, sm: 24 },
            zIndex: 1200,
            borderRadius: 999,
            px: 2.2,
            py: 1,
            fontWeight: 800,
            fontSize: 14,
            bgcolor: mode === 'dark' ? '#fb923c' : '#ea580c',
            color: mode === 'dark' ? '#1a1200' : '#ffffff',
            boxShadow:
              mode === 'dark'
                ? '0 8px 26px rgba(251,146,60,0.5)'
                : '0 8px 24px rgba(234,88,12,0.42)',
            '&:hover': { bgcolor: mode === 'dark' ? '#f97316' : '#c2410c' },
          }}
        >
          <CasinoRounded sx={{ mr: 1 }} />
          Betting
        </Fab>
      )}

      <Box
        component="footer"
        sx={{ py: 3, textAlign: 'center', borderTop: '1px solid', borderColor: 'cardBorder', color: 'text.secondary', fontSize: 13 }}
      >
        {leagueName}
        {season ? ` • ${season}` : ''}
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <Box sx={{ px: 2, py: 1, minWidth: 220 }}>
          <Typography variant="subtitle2">{name}</Typography>
          <Typography variant="body2" color="text.secondary">
            {profile.email}
          </Typography>
        </Box>
        <MenuItem onClick={handleSignOut}>
          <LogoutRounded sx={{ mr: 1, fontSize: 18 }} /> Sign out
        </MenuItem>
      </Menu>

      <Dialog open={verifyOpen} onClose={() => !verifyBusy && setVerifyOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Verify your new role</DialogTitle>
        <DialogContent>
          {pendingChange && (
            <Typography>
              The league admin granted you the <b>{ROLE_LABEL[pendingChange.new_role] || pendingChange.new_role}</b> role.
              Enter the 6-digit code sent to <b>your email address</b> to activate it.
            </Typography>
          )}
          {verifyMsg && (
            <Alert severity={verifyMsg.severity} sx={{ mt: 2 }}>
              {verifyMsg.text}
            </Alert>
          )}
          <TextField
            label="6-digit code"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            sx={{ mt: 2, width: '100%' }}
            inputProps={{ inputMode: 'numeric', 'aria-label': 'Verification code' }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerifyOpen(false)} disabled={verifyBusy}>Cancel</Button>
          <Button onClick={submitVerify} variant="contained" disabled={verifyBusy || verifyCode.length !== 6}>
            {verifyBusy ? 'Checking…' : 'Verify'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={6000}
        onClose={() => setToast(null)}
        onClick={() => {
          if (toast?.link) navigate(toast.link);
        }}
        sx={{ zIndex: 2000, bottom: 96 }}
      >
        <Alert
          onClose={() => setToast(null)}
          variant="filled"
          severity="success"
          sx={{ width: '100%' }}
        >
          <Box component="span" sx={{ fontWeight: 800 }}>
            {toast?.title}
          </Box>
          {toast?.body && (
            <Box component="span" sx={{ fontSize: 13 }}>
              {toast.body}
            </Box>
          )}
        </Alert>
      </Snackbar>
    </Box>
  );
}
