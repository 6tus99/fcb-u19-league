import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, Link as RouterLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import { useAuth } from '../context/AuthContext';
import supabase from '../lib/supabase';

const NAV = {
  admin: [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/users', label: 'Users' },
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
  const location = useLocation();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [leagueName, setLeagueName] = useState('FCB Under 19 Football League');
  const [season, setSeason] = useState('');

  useEffect(() => {
    supabase.from('league_settings').select('key, value').then(({ data }) => {
      (data || []).forEach((row) => {
        if (row.key === 'league_name' && row.value) setLeagueName(row.value);
        if (row.key === 'season' && row.value) setSeason(row.value);
      });
    });
  }, []);

  const items = NAV[profile.role] || NAV.fan;
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

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(10,15,28,0.92)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap', rowGap: 0.5, minHeight: 64 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <SportsSoccerRounded color="primary" />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.15 }} noWrap>
                {leagueName}
              </Typography>
              <Chip
                label={ROLE_LABEL[profile.role]}
                size="small"
                sx={{ height: 18, fontSize: 10, fontWeight: 700, bgcolor: 'rgba(74,222,128,0.12)', color: 'primary.main' }}
              />
            </Box>
          </Box>
          <Box sx={{ flexGrow: 1 }} />
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} size="small" aria-label="Account menu">
            <Avatar sx={{ width: 34, height: 34, bgcolor: 'primary.main', fontSize: 13, fontWeight: 800 }}>{initials}</Avatar>
          </IconButton>
        </Toolbar>
        <Toolbar sx={{ gap: 0.5, px: 2, minHeight: 48, overflowX: 'auto' }}>
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
                  color: active ? 'primary.main' : 'text.secondary',
                  bgcolor: active ? 'rgba(74,222,128,0.1)' : 'transparent',
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
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
        sx={{ py: 3, textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', color: 'text.secondary', fontSize: 13 }}
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
    </Box>
  );
}
