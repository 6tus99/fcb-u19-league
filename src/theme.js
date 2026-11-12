import { createTheme } from '@mui/material/styles';

export function buildTheme(mode) {
  const dark = mode === 'dark';
  return createTheme({
    palette: {
      mode,
      primary: { main: dark ? '#a3d15e' : '#76a52e' },
      secondary: { main: dark ? '#facc15' : '#ca8a04' },
      error: { main: dark ? '#f87171' : '#dc2626' },
      success: { main: dark ? '#a3d15e' : '#76a52e' },
      warning: { main: dark ? '#fbbf24' : '#d97706' },
      info: { main: dark ? '#8fa3e8' : '#17276a' },
      // borders — dark mode needs real presence, not a whisper of white
      divider: dark ? 'rgba(148, 163, 184, 0.30)' : 'rgba(15,23,42,0.14)',
      // card borders — brand-aware: navy edge on light, glowing steel-blue
      // on dark, so every card is clearly visible against its background
      cardBorder: dark ? 'rgba(143, 194, 68, 0.35)' : 'rgba(23, 39, 106, 0.25)',
      // three distinct navy layers: deep body → mid header → light cards
      background: dark
        ? { default: '#0a1029', paper: '#141f4a' }
        : { default: '#f4f6fb', paper: '#ffffff' },
      // NOTE: only set `text` for dark mode. Passing `text: undefined` for
      // light mode wipes MUI's default light text colors (MUI does not
      // fall back) — which blanked the whole app on first render.
      ...(dark
        ? {
            text: {
              primary: '#e9eefb',
              secondary: '#a7b6d6',
              disabled: 'rgba(167, 182, 214, 0.55)',
            },
          }
        : {}),
      // bank brand: blue header + green accents + white body (light mode),
      // layered navy throughout (dark mode)
      appbar: dark ? '#17276a' : '#ffffff',
      tint: dark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(255, 255, 255, 0.90)',
      tintHover: dark ? 'rgba(148, 163, 184, 0.15)' : 'rgba(255, 255, 255, 0.96)',
      headerText: dark ? '#ffffff' : '#101d4a',
      headerIcon: dark ? 'rgba(255,255,255,0.85)' : '#101d4a',
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
              : '1px solid rgba(23, 39, 106, 0.14)',
            boxShadow: dark
              ? '0 4px 20px rgba(2, 6, 23, 0.5)'
              : '0 2px 10px rgba(23, 39, 106, 0.10)',
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
