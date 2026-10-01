import React from 'react';
import ReactDOM from 'react-dom/client';
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
      <CssBaseline />
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
