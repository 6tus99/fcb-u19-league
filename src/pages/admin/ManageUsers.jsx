import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Typography from '@mui/material/Typography';
import Collapse from '@mui/material/Collapse';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import SearchRounded from '@mui/icons-material/SearchRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded';
import EditableCell from '../../components/EditableCell';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import { sha256Hex } from '../../utils/crypto';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

const ROLES = ['admin', 'commissioner', 'manager', 'player', 'fan'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// One identity color per role — used on the avatar, the badge and the tab pill.
const ROLE_STYLES = {
  all: { solid: '#16a34a', tint: 'rgba(22, 163, 74, 0.12)' },
  admin: { solid: '#7c3aed', tint: 'rgba(124, 58, 237, 0.12)' },
  commissioner: { solid: '#2563eb', tint: 'rgba(37, 99, 235, 0.12)' },
  manager: { solid: '#16a34a', tint: 'rgba(22, 163, 74, 0.12)' },
  player: { solid: '#d97706', tint: 'rgba(217, 119, 6, 0.12)' },
  fan: { solid: '#64748b', tint: 'rgba(100, 116, 139, 0.14)' },
};

const initialsOf = (name) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export default function ManageUsers() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(null);
  const [grant, setGrant] = useState(null); // { user, role } awaiting confirm
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantResult, setGrantResult] = useState(null); // { name, email, sent, code, role }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [tab, setTab] = useState('all'); // 'all' or one of ROLES
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null); // expanded row (accordion: one at a time)

  const load = useCallback(async () => {
    const [u, t] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, pending_role_changes!pending_role_changes_profile_id_fkey(id, status, new_role, expires_at)')
        .order('created_at'),
      supabase.from('teams').select('*'),
    ]);
    if (u.error) {
      setMessage({ severity: 'error', text: u.error.message });
      setUsers([]);
    } else {
      setUsers(u.data || []);
    }
    setTeams(t.data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pendingChange = (u) =>
    (u.pending_role_changes || []).find(
      (p) => p.status === 'pending' && new Date(p.expires_at) > new Date()
    );

  const changeRole = async (user, role) => {
    if (role === user.role) return;
    setGrant({ user, role });
  };

  const confirmGrant = async () => {
    const { user, role } = grant;
    setGrantBusy(true);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const codeHash = await sha256Hex(code);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    let sent = false;
    let devCode = code;
    let emailError = '';

    // Preferred path: Supabase edge function (sends the email via Resend).
    // Fallback: store the pending change directly.
    const { data } = await supabase.functions.invoke('send-role-code', {
      body: { profile_id: user.id, new_role: role, phone: user.phone || '', requested_by: me.id },
    });
    if (data && data.ok) {
      sent = !!data.sent;
      devCode = data.devCode || code;
      emailError = data.emailError || '';
    } else if (data && data.error) {
      setMessage({ severity: 'error', text: `Verification service: ${data.error}` });
    } else {
      emailError = 'The mailer function could not be reached — check that send-role-code is deployed.';
      const { error: insErr } = await supabase.from('pending_role_changes').insert({
        profile_id: user.id,
        new_role: role,
        code_hash: codeHash,
        phone: user.phone || null,
        requested_by: me.id,
        expires_at: expiresAt,
      });
      if (insErr) {
        setMessage({ severity: 'error', text: insErr.message });
        setGrantBusy(false);
        setGrant(null);
        return;
      }
    }

    setGrantBusy(false);
    setGrant(null);
    setGrantResult({
      name: user.full_name,
      email: data && data.email ? data.email : user.email,
      sent,
      code: devCode,
      emailError,
      role,
    });
    load();
  };

  const saveEmail = async (userId, email) => {
    const { error } = await supabase.from('profiles').update({ email }).eq('id', userId);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      setMessage({ severity: 'success', text: 'Email saved.' });
      load();
    }
  };

  const confirmDelete = async () => {
    setDeleteBusy(true);
    // Deleting a login needs the Supabase "delete-user" function (it uses a
    // server-only key — a website can never do this on its own).
    const { data, error } = await supabase.functions.invoke('delete-user', {
      body: { id: deleteTarget.id },
    });
    setDeleteBusy(false);
    setDeleteTarget(null);
    if (error || (data && data.error)) {
      setMessage({
        severity: 'error',
        text:
          (data && data.error) ||
          (error && error.message) ||
          'Delete failed. The delete-user function may not be deployed yet.',
      });
    } else {
      setMessage({ severity: 'success', text: 'Account deleted.' });
      load();
    }
  };

  const changeTeam = async (userId, teamId) => {
    const { error } = await supabase.from('profiles').update({ team_id: teamId || null }).eq('id', userId);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      setMessage({ severity: 'success', text: 'Team assignment updated.' });
      load();
    }
  };

  const savePhone = async (userId, phone) => {
    const { error } = await supabase.from('profiles').update({ phone }).eq('id', userId);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      setMessage({ severity: 'success', text: 'Phone number saved.' });
      load();
    }
  };

  if (!loaded) return <LoadingSpinner message="Loading users…" />;

  // Counts always reflect the whole group (search doesn't shrink them).
  const counts = { all: users.length };
  ROLES.forEach((r) => {
    counts[r] = users.filter((u) => u.role === r).length;
  });

  const q = query.trim().toLowerCase();
  const visible = users
    .filter((u) => (tab === 'all' ? true : u.role === tab))
    .filter(
      (u) =>
        !q ||
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );

  return (
    <div>
      <PageHeader
        title="Manage Users"
        subtitle="Change roles and team assignments for every registered member"
      />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard>
        {users.length === 0 ? (
          <EmptyState message="No registered users yet." />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {/* Search */}
            <TextField
              size="small"
              placeholder="Search by name or email…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              inputProps={{ 'aria-label': 'Search users' }}
              sx={{ width: { xs: '100%', md: 340 } }}
              InputProps={{
                startAdornment: (
                  <Box component="span" sx={{ color: 'text.secondary', mr: 0.5 }}>
                    <SearchRounded fontSize="small" />
                  </Box>
                ),
              }}
            />

            {/* Role filter pills */}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['all', ...ROLES].map((r) => {
                const active = tab === r;
                return (
                  <Button
                    key={r}
                    onClick={() => setTab(r)}
                    startIcon={
                      <Box
                        component="span"
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: active ? '#ffffff' : ROLE_STYLES[r].solid,
                          display: 'inline-block',
                        }}
                      />
                    }
                    variant="text"
                    color="inherit"
                    disableRipple
                    sx={{
                      borderRadius: 999,
                      px: 1.75,
                      py: 0.6,
                      fontWeight: 800,
                      fontSize: 13,
                      textTransform: 'none',
                      lineHeight: 1.4,
                      border: '1.5px solid',
                      borderColor: active ? 'transparent' : 'divider',
                      bgcolor: active ? ROLE_STYLES[r].solid : 'transparent',
                      color: active ? '#ffffff' : 'text.secondary',
                      transition: 'all 0.18s ease',
                      '&:hover': { bgcolor: active ? ROLE_STYLES[r].solid : ROLE_STYLES[r].tint },
                    }}
                  >
                    {r === 'all' ? 'All' : cap(r)} · {counts[r]}
                  </Button>
                );
              })}
            </Box>

            {/* User list — slim rows that expand on click */}
            {visible.length === 0 ? (
              <EmptyState
                message={
                  q
                    ? 'No users match your search.'
                    : tab === 'all'
                      ? 'No registered users yet.'
                      : `No ${cap(tab)}s yet.`
                }
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {visible.map((u) => {
                  const pending = pendingChange(u);
                  const roleStyle = ROLE_STYLES[u.role] || ROLE_STYLES.fan;
                  const open = openId === u.id;
                  return (
                    <Paper
                      key={u.id}
                      sx={{
                        borderRadius: 2.5,
                        border: '1.5px solid',
                        borderColor: open ? roleStyle.solid : 'divider',
                        bgcolor: 'tint',
                        overflow: 'hidden',
                        transition: 'border-color 0.15s ease',
                      }}
                    >
                      {/* Collapsed row — click to expand */}
                      <Box
                        onClick={() => setOpenId(open ? null : u.id)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          p: { xs: 1.25, md: 1.5 },
                          cursor: 'pointer',
                        }}
                      >
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            bgcolor: roleStyle.solid,
                            color: '#fff',
                            fontWeight: 800,
                            fontSize: 13,
                            flexShrink: 0,
                          }}
                        >
                          {initialsOf(u.full_name)}
                        </Avatar>
                        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography
                            noWrap
                            sx={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {u.full_name}
                            {u.id === me?.id ? ' (you)' : ''}
                          </Typography>
                          <Chip
                            label={cap(u.role)}
                            size="small"
                            sx={{
                              bgcolor: roleStyle.tint,
                              color: roleStyle.solid,
                              fontWeight: 800,
                              fontSize: 10.5,
                              height: 20,
                              flexShrink: 0,
                            }}
                          />
                          {pending && (
                            <Chip
                              label="code waiting"
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ fontSize: 10.5, height: 20, fontWeight: 700, flexShrink: 0 }}
                            />
                          )}
                        </Box>
                        <Typography
                          noWrap
                          variant="body2"
                          color="text.secondary"
                          sx={{ display: { xs: 'none', sm: 'block' }, maxWidth: 220 }}
                        >
                          {u.email}
                        </Typography>
                        {u.id !== me?.id && (
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete ${u.full_name}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(u);
                            }}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        )}
                        <ChevronRightRounded
                          sx={{
                            color: 'text.secondary',
                            flexShrink: 0,
                            transform: open ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.2s ease',
                          }}
                        />
                      </Box>

                      {/* Expanded detail — only for the clicked row */}
                      <Collapse in={open}>
                        <Box
                          sx={{
                            px: { xs: 1.5, md: 2 },
                            py: 2,
                            borderTop: '1px solid',
                            borderColor: 'divider',
                            display: 'grid',
                            gap: 1.75,
                            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                          }}
                        >
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontWeight: 800, letterSpacing: 0.8, fontSize: 10.5, display: 'block', mb: 0.25 }}
                            >
                              EMAIL
                            </Typography>
                            <EditableCell
                              value={u.email}
                              onSave={(v) => saveEmail(u.id, v)}
                              label={`Email for ${u.full_name}`}
                              width={220}
                            />
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontWeight: 800, letterSpacing: 0.8, fontSize: 10.5, display: 'block', mb: 0.25 }}
                            >
                              PHONE
                            </Typography>
                            <EditableCell
                              value={u.phone}
                              onSave={(v) => savePhone(u.id, v)}
                              label={`Phone for ${u.full_name}`}
                              width={160}
                              placeholder="no phone"
                            />
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontWeight: 800, letterSpacing: 0.8, fontSize: 10.5, display: 'block', mb: 0.25 }}
                            >
                              TEAM
                            </Typography>
                            <TextField
                              select
                              size="small"
                              value={u.team_id || ''}
                              onChange={(e) => changeTeam(u.id, e.target.value)}
                              sx={{ width: '100%' }}
                              inputProps={{ 'aria-label': `Team for ${u.full_name}` }}
                            >
                              <MenuItem value="">— no team —</MenuItem>
                              {teams.map((t) => (
                                <MenuItem key={t.id} value={t.id}>
                                  {t.name}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Box>
                          <Box>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontWeight: 800, letterSpacing: 0.8, fontSize: 10.5, display: 'block', mb: 0.25 }}
                            >
                              ROLE
                            </Typography>
                            <TextField
                              select
                              size="small"
                              value={u.role}
                              onChange={(e) => changeRole(u, e.target.value)}
                              sx={{ width: '100%' }}
                              inputProps={{ 'aria-label': `Role for ${u.full_name}` }}
                            >
                              {ROLES.map((r) => (
                                <MenuItem key={r} value={r}>
                                  {cap(r)}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Box>
                          <Box sx={{ gridColumn: '1 / -1' }}>
                            <Typography variant="caption" color="text.secondary">
                              Joined {formatDate(u.created_at)}
                            </Typography>
                          </Box>
                        </Box>
                      </Collapse>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        )}
      </GlassCard>

      <Dialog open={!!grant} onClose={() => !grantBusy && setGrant(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Grant a new role</DialogTitle>
        <DialogContent>
          {grant && (
            <>
              <Typography>
                Grant <b>{grant.user.full_name}</b> the <b>{grant.role}</b> role?
              </Typography>
              <Alert severity="info" sx={{ mt: 2 }}>
                A 6-digit security code will be sent by email to{' '}
                <b>{grant.user.email}</b>. The role only activates after they enter the
                code in the app (it expires in 15 minutes).
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrant(null)} disabled={grantBusy}>
            Cancel
          </Button>
          <Button onClick={confirmGrant} variant="contained" disabled={grantBusy}>
            {grantBusy ? 'Sending…' : 'Send code'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!grantResult} onClose={() => setGrantResult(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Role upgrade sent</DialogTitle>
        <DialogContent>
          {grantResult && (
            <>
              <Typography>
                <b>{grantResult.name}</b> will become a <b>{grantResult.role}</b> once they verify the code.
              </Typography>
              <Alert severity={grantResult.sent ? 'success' : 'warning'} sx={{ mt: 2 }}>
                {grantResult.sent ? (
                  `Code sent by email to ${grantResult.email}. Check the inbox (and spam).`
                ) : (
                  <>
                    Email delivery is not configured yet. Send this code to {grantResult.email} by any means:
                    <Typography sx={{ fontSize: 28, fontWeight: 900, letterSpacing: 4, mt: 1 }}>
                      {grantResult.code}
                    </Typography>
                  </>
                )}
              </Alert>
              {grantResult.emailError && !grantResult.sent && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
                  Why: {grantResult.emailError}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                The code expires in 15 minutes. If it is wrong or expired, grant the role again to send a new code.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setGrantResult(null)} variant="contained">
            Done
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => !deleteBusy && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete account</DialogTitle>
        <DialogContent>
          {deleteTarget && (
            <>
              <Typography>
                Permanently delete <b>{deleteTarget.full_name}</b> ({deleteTarget.email})?
              </Typography>
              <Alert severity="warning" sx={{ mt: 2 }}>
                This removes their login and all their league data. It cannot be undone.
              </Alert>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
            Cancel
          </Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={deleteBusy}>
            {deleteBusy ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
