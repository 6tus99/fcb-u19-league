// Prefix boundaries matter: /player/matches is restricted, /players is not.
// Match viewing (/matches/:id), social, messages and the fan home stay public
// to signed-in league members; role dashboards are a separate locked area.
export function isDashboardPath(pathname) {
  return /^\/(admin|commissioner|manager|player|editor)(?:\/|$)/.test(pathname || '');
}
