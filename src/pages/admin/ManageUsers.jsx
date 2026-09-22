import React, { useCallback, useEffect, useState } from 'react';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import { formatDate } from '../../utils/standings';
import { useAuth } from '../../context/AuthContext';
import supabase from '../../lib/supabase';

const ROLES = ['admin', 'commissioner', 'manager', 'player', 'fan'];

export default function ManageUsers() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    const [u, t] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('teams').select('*'),
    ]);
    setUsers(u.data || []);
    setTeams(t.data || []);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeRole = async (userId, role) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      setMessage({ severity: 'success', text: 'Role updated.' });
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
                  <TableCell sx={{ fontWeight: 700 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Joined</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {u.full_name}
                      {u.id === me?.id ? ' (you)' : ''}
                    </TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>{u.email}</TableCell>
                    <TableCell>
                      <TextField
                        select
                        value={u.role}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        sx={{ minWidth: 140 }}
                        inputProps={{ 'aria-label': `Role for ${u.full_name}` }}
                      >
                        {ROLES.map((r) => (
                          <MenuItem key={r} value={r}>
                            {r}
                          </MenuItem>
                        ))}
                      </TextField>
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
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </GlassCard>
    </div>
  );
}
