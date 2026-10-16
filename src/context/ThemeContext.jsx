import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext({ mode: 'light', choice: 'system', setChoice: () => {} });

const readChoice = () => {
  try {
    const c = window.localStorage.getItem('fcb-theme');
    return c === 'light' || c === 'dark' || c === 'system' ? c : 'system';
  } catch {
    return 'system';
  }
};

/**
 * Theme follows the DEVICE by default ("system"): dark phone -> dark app,
 * light phone -> light app, and it tracks live changes made in the OS.
 * The user can pin "light" or "dark" instead; that pin is remembered.
 */
export function ThemeManager({ children }) {
  const [choice, setChoice] = useState(readChoice); // 'system' | 'light' | 'dark'
  const [systemDark, setSystemDark] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  // Track the device's dark/light setting in real time.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem('fcb-theme', choice);
    } catch {
      /* storage unavailable — ignore */
    }
  }, [choice]);

  const mode = choice === 'system' ? (systemDark ? 'dark' : 'light') : choice;

  const value = useMemo(() => ({ mode, choice, setChoice }), [mode, choice]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}
