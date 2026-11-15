import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import TextField from '@mui/material/TextField';
import LockRounded from '@mui/icons-material/LockRounded';
import { useAuth } from '../context/AuthContext';
import { useDashboardAccess } from '../context/DashboardAccessContext';
import { sha256Hex } from '../utils/crypto';
import supabase from '../lib/supabase';

export default function DashboardGate({ children }) {
  const { profile } = useAuth();
  const { identity, unlocked, unlock } = useDashboardAccess();
  const navigate = useNavigate();
  const [phase, setPhase] = useState('loading');
  const [pin, setPin] = useState('');
  const [repeatPin, setRepeatPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const attempt = useRef(0);

  const checkPasswordSetup = useCallback(async () => {
    const current = ++attempt.current;
    setPhase('loading'); setError(''); setPin(''); setRepeatPin(''); setBusy(false);
    const { data, error: queryError } = await supabase.from('profiles')
      .select('id, dashboard_pin_hash').eq('id', profile.id).maybeSingle();
    if (current !== attempt.current) return;
    if (queryError || !data) {
      setError('Could not check your dashboard password. Please retry. Access remains locked.');
      setPhase('error');
      return;
    }
    setPhase(data.dashboard_pin_hash ? 'verify' : 'create');
  }, [profile.id]);

  useEffect(() => {
    if (unlocked) return undefined;
    checkPasswordSetup();
    return () => { attempt.current += 1; };
  }, [unlocked, identity, checkPasswordSetup]);

  const cancel = () => {
    if (busy) return;
    attempt.current += 1;
    setPin(''); setRepeatPin('');
    navigate('/fan', { replace: true });
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy || !['create', 'verify'].includes(phase)) return;
    if (!/^\d{6}$/.test(pin)) return setError('Enter your 6-digit password.');
    if (phase === 'create' && pin !== repeatPin) return setError('The two passwords do not match.');
    const current = attempt.current;
    const verifiedIdentity = identity;
    setBusy(true); setError('');
    try {
      const hash = await sha256Hex(`${profile.id}:${pin}`);
      if (current !== attempt.current) return;
      if (phase === 'create') {
        // Never overwrite a password created/reset by another device while
        // this dialog was open. No successful write = no dashboard access.
        const { data, error: writeError } = await supabase.from('profiles')
          .update({ dashboard_pin_hash: hash }).eq('id', profile.id)
          .is('dashboard_pin_hash', null).select('id').maybeSingle();
        if (current !== attempt.current) return;
        if (writeError) throw new Error('Could not save your dashboard password. Please try again.');
        if (!data) {
          setPhase('verify'); setPin(''); setRepeatPin('');
          throw new Error('Your password setup changed. Enter the current dashboard password.');
        }
      } else {
        // Re-read at submission so an old dialog cannot accept a password
        // that the admin has since reset.
        const { data, error: queryError } = await supabase.from('profiles')
          .select('id, dashboard_pin_hash').eq('id', profile.id).maybeSingle();
        if (current !== attempt.current) return;
        if (queryError || !data) throw new Error('Could not verify your password. Please try again.');
        if (!data.dashboard_pin_hash) {
          setPhase('create'); setPin(''); setRepeatPin('');
          throw new Error('Your dashboard password was reset. Create a new 6-digit password.');
        }
        if (data.dashboard_pin_hash !== hash) {
          setPin('');
          throw new Error('Wrong password — try again.');
        }
      }
      setPin(''); setRepeatPin(''); setBusy(false);
      // Stay on the exact requested URL (e.g. the assigned live match),
      // rather than replacing it with the dashboard landing page.
      unlock(verifiedIdentity);
    } catch (err) {
      if (current === attempt.current) setError(err.message || 'Could not unlock the dashboard. Please retry.');
    } finally {
      if (current === attempt.current) setBusy(false);
    }
  };

  if (unlocked) return children;

  // Crucially, children are NOT mounted while locked: no hidden match
  // controls, admin forms or page-level requests can run behind the dialog.
  return (
    <>
      <Box sx={{ p: 4, textAlign: 'center' }}><LockRounded color="primary" /><Typography sx={{ fontWeight: 700 }}>Dashboard locked</Typography><Typography variant="body2" color="text.secondary">Unlock to continue to this page.</Typography></Box>
      <Dialog open onClose={cancel} maxWidth="xs" fullWidth aria-labelledby="dashboard-password-title">
        <Box component="form" onSubmit={submit}>
          <DialogTitle id="dashboard-password-title" sx={{ fontWeight: 900 }}>{phase === 'create' ? 'Create your dashboard password' : 'Dashboard password'}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {phase === 'loading' ? 'Checking dashboard password setup…' : phase === 'create'
                ? 'Create a 6-digit password to open your dashboard. Keep it somewhere safe.'
                : 'Enter your 6-digit password to open this dashboard page.'}
            </Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {['create', 'verify'].includes(phase) && <TextField fullWidth autoFocus required label="6-digit password" type="password" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }} autoComplete={phase === 'create' ? 'new-password' : 'current-password'} />}
            {phase === 'create' && <TextField fullWidth required label="Repeat password" type="password" value={repeatPin}
              onChange={(e) => setRepeatPin(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy}
              inputProps={{ inputMode: 'numeric', maxLength: 6 }} autoComplete="new-password" sx={{ mt: 1.5 }} />}
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>Forgot it? The league admin can reset it from the Users page.</Typography>
          </DialogContent>
          <DialogActions>
            <Button type="button" onClick={cancel} disabled={busy}>Cancel</Button>
            {phase === 'error' ? <Button type="button" onClick={checkPasswordSetup}>Retry</Button> : <Button type="submit" variant="contained"
              disabled={busy || !['create', 'verify'].includes(phase) || pin.length !== 6 || (phase === 'create' && repeatPin.length !== 6)}>
              {busy ? 'Checking…' : phase === 'create' ? 'Save & open' : 'Unlock'}
            </Button>}
          </DialogActions>
        </Box>
      </Dialog>
    </>
  );
}
