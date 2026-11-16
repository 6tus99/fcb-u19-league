import { useEffect, useState } from 'react';

// Only the contextual community shortcut fades; the betting chip and main
// navigation stay available. Every activity starts a fresh four-second window.
export default function useAutoHideShortcut(enabled, pageKey, delay = 4000) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return undefined;
    }
    let timer;
    const reveal = () => {
      if (document.visibilityState === 'hidden') return;
      clearTimeout(timer);
      setVisible(true);
      timer = window.setTimeout(() => setVisible(false), delay);
    };
    reveal();
    // Capture scrolls inside nested panels too, not just the window itself.
    window.addEventListener('scroll', reveal, { passive: true, capture: true });
    window.addEventListener('pointerdown', reveal, { passive: true });
    window.addEventListener('keydown', reveal);
    window.addEventListener('focus', reveal);
    window.addEventListener('pageshow', reveal);
    document.addEventListener('visibilitychange', reveal);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('scroll', reveal, true);
      window.removeEventListener('pointerdown', reveal);
      window.removeEventListener('keydown', reveal);
      window.removeEventListener('focus', reveal);
      window.removeEventListener('pageshow', reveal);
      document.removeEventListener('visibilitychange', reveal);
    };
  }, [enabled, pageKey, delay]);

  return enabled && visible;
}
