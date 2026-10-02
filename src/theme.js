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
        ? { default: '#0a1128', paper: '#111c3a' }
        : { default: '#f2f5fb', paper: '#ffffff' },
      // bank brand: blue header + green accents + white body (light mode),
      // dark blue throughout (dark mode)
      appbar: dark ? 'rgba(15,28,64,0.94)' : '#1e3a8a',
      tint: dark ? 'rgba(255,255,255,0.04)' : 'rgba(30,58,138,0.045)',
      tintHover: dark ? 'rgba(255,255,255,0.08)' : 'rgba(30,58,138,0.08)',
      headerText: '#ffffff',
      headerIcon: 'rgba(255,255,255,0.85)',
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
