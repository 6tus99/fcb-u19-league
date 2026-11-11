import { useEffect, useState } from 'react';
import supabase from '../lib/supabase';

/**
 * Per-member nickname (display_name) and profile photo (avatar_url).
 *
 * Loaded with its own query so the rest of the app keeps working even
 * before the display_name/avatar_url columns exist: if the query fails,
 * every name simply falls back to the member's real name.
 */
export function useMemberInfo(ids) {
  const [info, setInfo] = useState({});
  const list = [...new Set((ids || []).filter(Boolean))].slice(0, 100);
  const key = list.slice().sort().join(',');

  useEffect(() => {
    if (!key) {
      setInfo({});
      return undefined;
    }
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', key.split(','));
        if (!alive) return;
        const m = {};
        (data || []).forEach((r) => {
          m[r.id] = r;
        });
        setInfo(m);
      } catch {
        if (alive) setInfo({});
      }
    })();
    return () => {
      alive = false;
    };
  }, [key]);

  return info;
}

/** Nickname if set, otherwise the given fallback (usually the real name). */
export function memberName(info, id, fallback) {
  const d = info && info[id] ? info[id].display_name : null;
  return d && d.trim() ? d.trim() : fallback;
}

/** Profile photo URL, or null when the member has no photo yet. */
export function memberAvatar(info, id) {
  return (info && info[id] && info[id].avatar_url) || null;
}
