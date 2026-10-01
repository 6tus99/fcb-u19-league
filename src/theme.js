import { createTheme } from '@mui/material/styles';

export function buildTheme(mode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#4ade80' : '#16a34a' },
      secondary: { main: dark ? '#facc15' : '#ca8a04' },
      error: { main: dark ? '#f87171' : '#dc2626' },
      divider: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.14)',
      background: dark
        ? { default: '#0a0f1c', paper: '#111a2e' }
        : { default: '#f3f5fb', paper: '#ffffff' },
      // custom keys used across components (theme-aware surfaces)
      appbar: dark ? 'rgba(10,15,28,0.92)' : 'rgba(255,255,255,0.92)',
      tint: dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.045)',
      tintHover: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)',
    },
    typography: {
      fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      h4: { fontWeight: 800 },
      h5: { fontWeight: 700 },
      h6: { fontWeight: 700 },
    },
    shape: { borderRadius: 12 },
    components: {
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiCard: {
        styleOverrides: { root: { backgroundImage: 'none' } },
      },
      MuiButton: {
        styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } },
      },
      MuiTextField: {
        defaultProps: { size: 'small' },
      },
    },
  });
}

const defaultTheme = buildTheme('dark');
export default defaultTheme;
