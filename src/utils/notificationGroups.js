// Existing match alerts already share a /matches/:id link. Group by that
// immutable ID, never by team names (the same teams can meet more than once).
export function notificationMatchId(notification) {
  const match = String(notification?.link || '').match(
    /^\/matches\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?(?:[?#].*)?$/i
  );
  return match ? match[1].toLowerCase() : null;
}

export function groupNotifications(notifications) {
  const groups = new Map();
  const unique = new Map(notifications.map((n) => [n.id, n]));
  const newestFirst = (a, b) => (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
  [...unique.values()]
    .filter((n) => !(n.read_at && String(n.link || '').startsWith('/messages/')))
    .sort(newestFirst)
    .forEach((n) => {
      const matchId = notificationMatchId(n);
      const key = matchId ? `match:${matchId}` : `notice:${n.id}`;
      if (!groups.has(key)) groups.set(key, { key, matchId, events: [], latest: n, unread: 0 });
      const group = groups.get(key);
      group.events.push(n);
      if (!n.read_at) group.unread += 1;
    });
  return [...groups.values()];
}
