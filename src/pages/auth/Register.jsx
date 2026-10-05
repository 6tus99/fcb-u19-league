import React, { useState } from 'react';
import { Link as RouterLink, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Link from '@mui/material/Link';
import SportsSoccerRounded from '@mui/icons-material/SportsSoccerRounded';
import { useAuth } from '../../context/AuthContext';
import { homeForRole } from '../../components/ProtectedRoute';
import LoadingSpinner from '../../components/LoadingSpinner';
import ThemeToggleFloat from '../../components/ThemeToggleFloat';

export default function Register() {
  const { user, profile, register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && profile) return <Navigate to={homeForRole(profile.role)} replace />;
  if (user) return <LoadingSpinner message="Creating your account…" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register({
        fullName,
        email,
        password,
        phone,
      });
      // With email confirmation disabled (see README), the session is created
      // immediately and the app redirects automatically.
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
        background: 'radial-gradient(circle at 20% 10%, rgba(34,197,94,0.12), transparent 45%), radial-gradient(circle at 85% 90%, rgba(59,130,246,0.10), transparent 45%)',
      }}
    >
      <ThemeToggleFloat />
      <Paper sx={{ p: 4, width: '100%', maxWidth: 460, borderRadius: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SportsSoccerRounded color="primary" sx={{ fontSize: 52 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
            Join the league
          </Typography>
          <Typography color="text.secondary">Create your account</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Full name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            fullWidth
            autoComplete="name"
          />
          <TextField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            autoComplete="email"
          />
          <TextField
            label="Password (min. 6 characters)"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            autoComplete="new-password"
          />
          <TextField
            label="Phone number"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            placeholder="+265 99 123 4567"
            helperText="Used to send security codes if an admin upgrades your role"
            autoComplete="tel"
          />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? 'Creating account…' : 'Create account'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          Already registered?{' '}
          <Link component={RouterLink} to="/login" variant="body2" sx={{ fontWeight: 700 }}>
            Sign in
          </Link>
        </Typography>
        <Typography variant="caption" color="text.secondary" align="center" display="block" sx={{ mt: 1 }}>
          Everyone joins as a fan. If you are a player or manager, the league admin will
          upgrade your role (a security code is sent to your phone).
        </Typography>
      </Paper>
    </Box>
  );
}
