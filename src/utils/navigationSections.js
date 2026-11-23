export const inPath = (pathname, root) => pathname === root || pathname.startsWith(`${root}/`);

export function leagueSection(pathname) {
  if (inPath(pathname, '/matches')) return '/matches';
  if (inPath(pathname, '/teams')) return '/teams';
  return '/standings';
}

export function navigationItemActive(pathname, target) {
  if (target === '/standings') return ['/standings', '/matches', '/teams'].some((root) => inPath(pathname, root));
  if (target === '/social') return ['/social', '/messages'].some((root) => inPath(pathname, root));
  return inPath(pathname, target);
}

export function shouldShowFanNavigationIcon(active, expanded) {
  return active || !expanded;
}

export function communityShortcut(pathname) {
  if (inPath(pathname, '/news')) return { to: '/social', label: 'kuma-stand' };
  if (inPath(pathname, '/social')) return { to: '/messages', label: 'Messages' };
  return null;
}
