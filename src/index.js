import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { buildTheme } from './theme';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ThemeManager, useThemeMode } from './context/ThemeContext';

function ThemedShell({ children }) {
  const { mode } = useThemeMode();
  return (
    <ThemeProvider theme={buildTheme(mode)}>
      {/* colorScheme hands the effective mode to the OS so native chrome
          (scrollbars, pickers, number spinners, media controls) uses the
          system's own colors for light/dark */}
      <CssBaseline colorScheme={mode} />
      {children}
    </ThemeProvider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ThemeManager>
      <BrowserRouter>
        <AuthProvider>
          <ThemedShell>
            <App />
          </ThemedShell>
        </AuthProvider>
      </BrowserRouter>
    </ThemeManager>
  </React.StrictMode>
);

// PWA: register the service worker so the app shell is cached
// (instant open + offline fallback). Production only.
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
