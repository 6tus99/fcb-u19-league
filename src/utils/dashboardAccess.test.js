import { isDashboardPath } from './dashboardAccess';

test('covers every role workspace, nested match controls and legacy dashboard URLs', () => {
  ['/admin', '/admin/users', '/commissioner/match-center/live/a-match', '/commissioner/live/a-match', '/commissioner/reports', '/manager/matches', '/player', '/player/matches', '/editor/news'].forEach((path) => expect(isDashboardPath(path)).toBe(true));
});

test('leaves fan match viewing, messages and similarly named public paths outside the lock', () => {
  ['/fan', '/matches', '/matches/a-match', '/standings', '/messages/a-user', '/social', '/teams', '/news', '/login', '/players', '/administrator', '', undefined].forEach((path) => expect(isDashboardPath(path)).toBe(false));
});
