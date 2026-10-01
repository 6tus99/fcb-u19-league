import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({ mode: 'dark', toggle: () => {} });

export function ThemeManager({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      return window.localStorage.getItem('fcb-theme') || 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('fcb-theme', mode);
    } catch {
      /* storage unavailable — ignore */
    }
  }, [mode]);

  const value = useMemo(
    () => ({ mode, toggle: () => setMode((m) => (m === 'dark' ? 'light' : 'dark')) }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
