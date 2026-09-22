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

export default function Login() {
  const { user, profile, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user && profile) return <Navigate to={homeForRole(profile.role)} replace />;
  if (user) return <LoadingSpinner message="Redirecting…" />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Wrong email or password.' : err.message);
    } finally {
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
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420, borderRadius: 3 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SportsSoccerRounded color="primary" sx={{ fontSize: 52 }} />
          <Typography variant="h5" sx={{ fontWeight: 800, mt: 1 }}>
            FCB Under 19 Football League
          </Typography>
          <Typography color="text.secondary">Sign in to continue</Typography>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="Email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />
          <TextField
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />
          <Button type="submit" variant="contained" size="large" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </Box>

        <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 2 }}>
          No account yet?{' '}
          <Link component={RouterLink} to="/register" variant="body2" sx={{ fontWeight: 700 }}>
            Register
          </Link>
        </Typography>
      </Paper>
    </Box>
  );
}
