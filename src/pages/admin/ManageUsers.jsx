import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
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

export default function ManageUsers() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(null);
  const [grant, setGrant] = useState(null); // { user, role } awaiting confirm
  const [grantBusy, setGrantBusy] = useState(false);
  const [grantResult, setGrantResult] = useState(null); // { name, phone, sent, code, role }

  const load = useCallback(async () => {
    const [u, t] = await Promise.all([
      supabase
        .from('profiles')
        .select('*, pending_role_changes(id, status, new_role, expires_at)')
        .order('created_at'),
      supabase.from('teams').select('*'),
    ]);
    setUsers(u.data || []);
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

    // Preferred path: Supabase edge function (sends the SMS if Twilio is
    // configured there). Fallback: store the pending change directly.
    const { data } = await supabase.functions.invoke('send-role-code', {
      body: { profile_id: user.id, new_role: role, phone: user.phone || '', requested_by: me.id },
    });
    if (data && data.ok) {
      sent = !!data.sent;
      devCode = data.devCode || code;
    } else if (data && data.error) {
      setMessage({ severity: 'error', text: `Verification service: ${data.error}` });
    } else {
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
    setGrantResult({ name: user.full_name, phone: user.phone, sent, code: devCode, role });
    load();
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
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => {
                  const pending = pendingChange(u);
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {u.full_name}
                        {u.id === me?.id ? ' (you)' : ''}
                      </TableCell>
                      <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{u.email}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          value={u.phone || ''}
                          onChange={(e) =>
                            setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, phone: e.target.value } : x)))
                          }
                          onBlur={(e) => {
                            if ((e.target.value || '') !== (u.phone || '')) savePhone(u.id, e.target.value.trim());
                          }}
                          sx={{ minWidth: 150 }}
                          inputProps={{ 'aria-label': `Phone for ${u.full_name}`, placeholder: 'no phone' }}
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
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
                A 6-digit security code will be sent to their phone
                {grant.user.phone ? ` (${grant.user.phone})` : ' — no phone number on file, so you will need to send it yourself'}
                . The role only activates after they enter the code in the app (it expires in 15 minutes).
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
                  `Code sent by SMS to ${grantResult.phone}.`
                ) : (
                  <>
                    SMS delivery is not configured yet. Send this code to {grantResult.phone || 'the user'}:
                    <Typography sx={{ fontSize: 28, fontWeight: 900, letterSpacing: 4, mt: 1 }}>
                      {grantResult.code}
                    </Typography>
                  </>
                )}
              </Alert>
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
    </div>
  );
}
