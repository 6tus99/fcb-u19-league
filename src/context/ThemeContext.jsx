import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({ mode: 'light', toggle: () => {} });

export function ThemeManager({ children }) {
  const [mode, setMode] = useState(() => {
    try {
      // Light is the default; dark is a personal choice the user makes (and we remember).
      return window.localStorage.getItem('fcb-theme') || 'light';
    } catch {
      return 'light';
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
