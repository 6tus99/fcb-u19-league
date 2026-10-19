import { useEffect, useRef } from 'react';

/**
 * Safety net for the "why do I keep refreshing?" era.
 * Re-runs `callback` on a fixed interval so no page is ever stale for
 * long, even when the realtime socket happens to be down.
 * Realtime stays the instant path; this is the guarantee.
 */
export default function useAutoRefresh(callback, intervalMs = 15000) {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  });
  useEffect(() => {
    const t = window.setInterval(() => cbRef.current(), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
}
