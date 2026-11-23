import { communityShortcut, leagueSection, navigationItemActive, shouldShowFanNavigationIcon } from './navigationSections';

test('matches and team detail URLs belong to Standings without changing deep links', () => {
  ['/standings', '/matches', '/matches/match-id', '/teams', '/teams/team-id'].forEach((path) => expect(navigationItemActive(path, '/standings')).toBe(true));
  expect(leagueSection('/matches/match-id')).toBe('/matches');
  expect(leagueSection('/teams/team-id')).toBe('/teams');
  expect(leagueSection('/standings')).toBe('/standings');
});

test('Social is the parent of Messages; News stays a separate top-level section', () => {
  ['/social', '/messages', '/messages/friend'].forEach((path) => {
    expect(navigationItemActive(path, '/social')).toBe(true);
    expect(navigationItemActive(path, '/news')).toBe(false);
  });
  ['/news', '/news/story'].forEach((path) => {
    expect(navigationItemActive(path, '/news')).toBe(true);
    expect(navigationItemActive(path, '/social')).toBe(false);
  });
  expect(navigationItemActive('/admin/news', '/news')).toBe(false);
  expect(navigationItemActive('/social-club', '/news')).toBe(false);
});

test('only News and Social get shortcuts, never an open chat', () => {
  expect(communityShortcut('/news')).toEqual({ to: '/social', label: 'kuma-stand' });
  expect(communityShortcut('/news/story')).toEqual({ to: '/social', label: 'kuma-stand' });
  expect(communityShortcut('/social')).toEqual({ to: '/messages', label: 'Messages' });
  ['/fan', '/standings', '/matches', '/messages', '/messages/friend', '/admin/news'].forEach((path) => expect(communityShortcut(path)).toBeNull());
});

test('active fan navigation always shows its icon; inactive items follow the activity state', () => {
  expect(shouldShowFanNavigationIcon(true, true)).toBe(true);
  expect(shouldShowFanNavigationIcon(true, false)).toBe(true);
  expect(shouldShowFanNavigationIcon(false, true)).toBe(false);
  expect(shouldShowFanNavigationIcon(false, false)).toBe(true);
});
