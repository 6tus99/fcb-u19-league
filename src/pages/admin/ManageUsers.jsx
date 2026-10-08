import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import EditableCell from '../../components/EditableCell';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
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

  const counts = { all: users.length };
  ROLES.forEach((r) => {
    counts[r] = users.filter((u) => u.role === r).length;
  });
  const visible = tab === 'all' ? users : users.filter((u) => u.role === tab);

  return (
    <div>
      <PageHeader title="Manage Users" subtitle="Change roles and team assignments for every registered member" />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <GlassCard>
        {users.length === 0 ? (
          <EmptyState message="No registered users yet." />
        ) : (
          <Box>
            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
              variant="scrollable"
              allowScrollButtonsMobile
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}
            >
              <Tab label={`All (${counts.all})`} value="all" />
              {ROLES.map((r) => (
                <Tab key={r} label={`${cap(r)} (${counts[r]})`} value={r} />
              ))}
            </Tabs>
            {visible.length === 0 ? (
              <EmptyState message={`No ${cap(tab)}s yet.`} />
            ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Joined</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((u) => {
                  const pending = pendingChange(u);
                  return (
                    <TableRow key={u.id} hover>
                  <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {u.full_name}
                    {u.id === me?.id ? ' (you)' : ''}
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={u.email}
                      onSave={(v) => saveEmail(u.id, v)}
                      label={`Email for ${u.full_name}`}
                      width={190}
                    />
                  </TableCell>
                  <TableCell>
                    <EditableCell
                      value={u.phone}
                      onSave={(v) => savePhone(u.id, v)}
                      label={`Phone for ${u.full_name}`}
                      width={140}
                      placeholder="no phone"
                    />
                  </TableCell>
                      <TableCell>
                        <Box>
                          <TextField
                            select
                            value={u.role}
                            onChange={(e) => changeRole(u, e.target.value)}
                            sx={{ minWidth: 140 }}
                            inputProps={{ 'aria-label': `Role for ${u.full_name}` }}
                          >
                            {ROLES.map((r) => (
                              <MenuItem key={r} value={r}>
                                {r}
                              </MenuItem>
                            ))}
                          </TextField>
                          {pending && (
                            <Chip
                              label={`code sent → ${pending.new_role}`}
                              size="small"
                              color="warning"
                              variant="outlined"
                              sx={{ mt: 0.5, fontSize: 10, fontWeight: 700 }}
                            />
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          value={u.team_id || ''}
                          onChange={(e) => changeTeam(u.id, e.target.value)}
                          sx={{ minWidth: 180 }}
                          inputProps={{ 'aria-label': `Team for ${u.full_name}` }}
                        >
                          <MenuItem value="">— no team —</MenuItem>
                          {teams.map((t) => (
                            <MenuItem key={t.id} value={t.id}>
                              {t.name}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{formatDate(u.created_at)}</TableCell>
                      <TableCell>
                        {u.id !== me?.id && (
                          <IconButton
                            size="small"
                            color="error"
                            aria-label={`Delete ${u.full_name}`}
                            onClick={() => setDeleteTarget(u)}
                          >
                            <DeleteOutlineRounded fontSize="small" />
                          </IconButton>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
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
          <Button onClick={() => setGrant(null)} disabled={grantBusy}>Cancel</Button>
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
          <Button onClick={() => setGrantResult(null)} variant="contained">Done</Button>
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
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={deleteBusy}>
            {deleteBusy ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
