import React, { useCallback, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import PageHeader from '../../components/PageHeader';
import GlassCard from '../../components/GlassCard';
import LoadingSpinner from '../../components/LoadingSpinner';
import EmptyState from '../../components/EmptyState';
import StatusChip from '../../components/StatusChip';
import { formatDate } from '../../utils/standings';
import supabase from '../../lib/supabase';

const SELECT =
  '*, requester:profiles!requests_requested_by_fkey (id, full_name, email), player:profiles!requests_player_profile_id_fkey (id, full_name, email), team:teams!requests_team_id_fkey (id, name, short_name), from_team:teams!requests_from_team_id_fkey (id, name, short_name)';

export default function ManageRequests() {
  const [filter, setFilter] = useState('pending');
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    let q = supabase.from('requests').select(SELECT).order('created_at', { ascending: false });
    if (filter === 'pending') q = q.eq('status', 'pending');
    const { data, error } = await q;
    if (error) setMessage({ severity: 'error', text: error.message });
    setRows(data || []);
    setLoaded(true);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = async (id, status) => {
    setBusyId(id);
    const { error } = await supabase.from('requests').update({ status }).eq('id', id);
    setBusyId(null);
    if (error) {
      setMessage({ severity: 'error', text: error.message });
    } else {
      setMessage({
        severity: 'success',
        text:
          status === 'approved'
            ? 'Approved — the player has been updated in the league.'
            : 'Request rejected.',
      });
      load();
    }
  };

  if (!loaded) return <LoadingSpinner message="Loading requests…" />;

  return (
    <div>
      <PageHeader
        title="Team Requests"
        subtitle="Managers' player additions and players' transfer requests — approving applies the change instantly"
      />

      {message && (
        <Alert severity={message.severity} sx={{ mb: 2 }} onClose={() => setMessage(null)}>
          {message.text}
        </Alert>
      )}

      <ToggleButtonGroup
        exclusive
        size="small"
        value={filter}
        onChange={(_, v) => v && setFilter(v)}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="pending" sx={{ fontWeight: 700 }}>
          Pending
        </ToggleButton>
        <ToggleButton value="all" sx={{ fontWeight: 700 }}>
          All
        </ToggleButton>
      </ToggleButtonGroup>

      <GlassCard>
        {rows.length === 0 ? (
          <EmptyState
            message={
              filter === 'pending'
                ? 'No pending requests. When a manager adds a player or a player requests a transfer, it appears here.'
                : 'No requests yet.'
            }
          />
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>Player</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Team</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Requested by</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Note</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {r.player?.full_name || 'Unknown'}
                      <Typography component="div" variant="caption" color="text.secondary" sx={{ fontWeight: 400 }}>
                        {r.player?.email}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={r.type === 'add_player' ? 'Add player' : 'Transfer'}
                        size="small"
                        color={r.type === 'add_player' ? 'info' : 'secondary'}
                        sx={{ fontWeight: 700, height: 20, fontSize: 11 }}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {r.type === 'add_player' ? (
                        r.team?.name || '—'
                      ) : (
                        <>
                          {r.from_team?.name || '?'} → <strong>{r.team?.name || '?'}</strong>
                        </>
                      )}
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{r.requester?.full_name || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', maxWidth: 180 }}>{r.note || '—'}</TableCell>
                    <TableCell sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                      {formatDate(r.created_at)}
                    </TableCell>
                    <TableCell>
                      {r.status === 'pending' ? (
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button
                            size="small"
                            variant="contained"
                            disabled={busyId === r.id}
                            onClick={() => resolve(r.id, 'approved')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="small"
                            variant="outlined"
                            color="error"
                            disabled={busyId === r.id}
                            onClick={() => resolve(r.id, 'rejected')}
                          >
                            Reject
                          </Button>
                        </Box>
                      ) : (
                        <StatusChip status={r.status} />
                      )}
                    </TableCell>
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
