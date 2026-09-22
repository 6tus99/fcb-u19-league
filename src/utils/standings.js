export function computeStandings(matches, teams) {
  const rows = new Map();
  teams.forEach((t) => rows.set(t.id, { team: t, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0 }));
  matches
    .filter((m) => m.status === 'finished')
    .forEach((m) => {
      const h = rows.get(m.home_team_id);
      const a = rows.get(m.away_team_id);
      if (!h || !a) return;
      h.P += 1;
      a.P += 1;
      h.GF += m.home_score;
      h.GA += m.away_score;
      a.GF += m.away_score;
      a.GA += m.home_score;
      if (m.home_score > m.away_score) {
        h.W += 1;
        a.L += 1;
      } else if (m.home_score < m.away_score) {
        a.W += 1;
        h.L += 1;
      } else {
        h.D += 1;
        a.D += 1;
      }
    });
  return [...rows.values()]
    .map((r) => ({ ...r, GD: r.GF - r.GA, Pts: r.W * 3 + r.D }))
    .sort((x, y) => y.Pts - x.Pts || y.GD - x.GD || y.GF - x.GF);
}

export function formatDate(iso, withTime = false) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  });
}

export const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const fromLocalInput = (value) => new Date(value).toISOString();
