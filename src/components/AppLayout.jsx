import React, { useEffect, useState } from 'react';
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
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import ArrowBackIosRounded from '@mui/icons-material/ArrowBackIosRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
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
    { to: '/commissioner/events', label: 'Match Events' },
    { to: '/commissioner/reports', label: 'Match Reports' },
    { to: '/matches', label: 'Matches' },
    { to: '/standings', label: 'Standings' },
  ],
  manager: [
    { to: '/manager', label: 'My Team' },
    { to: '/matches', label: 'Matches' },
    { to: '/standings', label: 'Standings' },
    { to: '/teams', label: 'Teams' },
    { to: '/news', label: 'News' },
  ],
  player: [
    { to: '/player', label: 'My Team' },
    { to: '/matches', label: 'Matches' },
    { to: '/standings', label: 'Standings' },
    { to: '/teams', label: 'Teams' },
    { to: '/news', label: 'News' },
  ],
  fan: [
    { to: '/fan', label: 'Home' },
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
  fan: 'Fan',
};

export default function AppLayout() {
  const { profile, signOut } = useAuth();
  const { mode, toggle } = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
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

  const submitVerify = async () => {
    setVerifyBusy(true);
    setVerifyMsg(null);
    const { data, error } = await supabase.functions.invoke('verify-role-code', {
      body: { code: verifyCode.trim() },
    });
    setVerifyBusy(false);
    if (error) {
      setVerifyMsg({
        severity: 'warning',
        text: 'Verification is not set up yet. The admin needs to add the two small Supabase functions (send-role-code and verify-role-code). Your code is stored and will work as soon as that is done.',
      });
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

  // Everyone sees the fan view (fan home + fan menu) by default. When a user
  // enters the area they were assigned (via "My dashboard"), the menu for
  // that area takes over.
  const inRoleArea =
    profile.role !== 'fan' &&
    location.pathname.startsWith(dashboardForRole(profile.role));
  const items = inRoleArea ? NAV[profile.role] || NAV.fan : NAV.fan;
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
          <IconButton onClick={handleBack} size="small" aria-label="Go back" sx={{ color: 'headerIcon', flexShrink: 0 }}>
            <ArrowBackIosRounded sx={{ fontSize: 20 }} />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, flexGrow: 1 }}>
            <SportsSoccerRounded sx={{ color: 'headerText', fontSize: 26, flexShrink: 0 }} />
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
              onClick={() => navigate(dashboardForRole(profile.role))}
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
          <IconButton onClick={toggle} size="small" aria-label="Toggle light/dark mode" sx={{ color: 'headerIcon', flexShrink: 0 }}>
            {mode === 'dark' ? <LightModeRounded /> : <DarkModeRounded />}
          </IconButton>
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

      <Box
        component="footer"
        sx={{ py: 3, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider', color: 'text.secondary', fontSize: 13 }}
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
    </Box>
  );
}
