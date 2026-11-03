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

// PWA v33 (DEBUG): something on user devices (phone + PC) is white.
// The live site itself renders fine (verified headlessly), so this version
// does NOT register a new service worker — it PURGES every existing one +
// all its caches and reloads once, so every device starts completely fresh
// with no old app copy in the way. If the white screen survives this, the
// problem is on the device/network side, not the app code.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map((r) => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        window.location.reload();
      }
    } catch (e) {
      /* stay on the page — never let cleanup break the app */
    }
  });
}
