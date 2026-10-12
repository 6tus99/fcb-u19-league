import { createTheme } from '@mui/material/styles';

export function buildTheme(mode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#4ade80' : '#16a34a' },
      secondary: { main: dark ? '#facc15' : '#ca8a04' },
      error: { main: dark ? '#f87171' : '#dc2626' },
      success: { main: dark ? '#4ade80' : '#16a34a' },
      warning: { main: dark ? '#fbbf24' : '#d97706' },
      info: { main: dark ? '#60a5fa' : '#2563eb' },
      // borders — dark mode needs real presence, not a whisper of white
      divider: dark ? 'rgba(148, 163, 184, 0.30)' : 'rgba(15,23,42,0.14)',
      // three distinct navy layers: deep body → mid header → light cards
      background: dark
        ? { default: '#070d1f', paper: '#111e42' }
        : { default: '#f2f5fb', paper: '#ffffff' },
      text: dark
        ? {
            primary: '#e9eefb',
            secondary: '#a7b6d6',
            disabled: 'rgba(167, 182, 214, 0.55)',
          }
        : undefined,
      // bank brand: blue header + green accents + white body (light mode),
      // layered navy throughout (dark mode)
      appbar: dark ? '#0c1735' : '#1e3a8a',
      tint: dark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(30,58,138,0.045)',
      tintHover: dark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(30,58,138,0.08)',
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
      MuiAppBar: {
        styleOverrides: {
          root: {
            // the brand line: green (dark) / light (light) under the header
            borderBottom: dark
              ? '1px solid rgba(74, 222, 128, 0.35)'
              : '1px solid rgba(255,255,255,0.25)',
            boxShadow: dark
              ? '0 4px 20px rgba(2, 6, 23, 0.5)'
              : '0 2px 12px rgba(30, 58, 138, 0.2)',
          },
        },
      },
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
