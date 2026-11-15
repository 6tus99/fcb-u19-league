import { groupNotifications, notificationMatchId } from './notificationGroups';

const matchA = '01b20000-0000-4000-8000-000000000020';
const matchB = '01b20000-0000-4000-8000-000000000025';
const notice = (id, matchId, date, extra = {}) => ({ id, link: `/matches/${matchId}`, title: 'Event', created_at: date, read_at: null, ...extra });

test('kickoff, goals, cards and corrections are bundled by fixture ID, latest first', () => {
  const rows = [
    notice('start', matchA, '2026-09-22T10:00:00Z'),
    notice('goal', matchA, '2026-09-22T10:15:00Z', { title: 'GOAL!' }),
    notice('other', matchB, '2026-09-22T10:10:00Z'),
    notice('card', matchA, '2026-09-22T10:20:00Z', { read_at: '2026-09-22T10:21:00Z' }),
  ];
  const copy = JSON.stringify(rows);
  const groups = groupNotifications(rows);
  expect(groups).toHaveLength(2);
  expect(groups[0].matchId).toBe(matchA);
  expect(groups[0].events.map((n) => n.id)).toEqual(['card', 'goal', 'start']);
  expect(groups[0].unread).toBe(2);
  expect(groups[1].matchId).toBe(matchB);
  expect(JSON.stringify(rows)).toBe(copy);
});

test('different fixtures involving the same teams stay separate', () => {
  expect(groupNotifications([notice('a', matchA, '', { title: 'Nyambadwe vs Ekhaya' }), notice('b', matchB, '', { title: 'Nyambadwe vs Ekhaya' })])).toHaveLength(2);
});

test('non-match notices stay separate and read chat notices disappear', () => {
  const groups = groupNotifications([
    notice('one', '', '', { link: '/requests', title: 'Transfer' }),
    notice('two', '', '', { link: '/requests', title: 'Transfer approved' }),
    notice('chat', '', '', { link: '/messages/person', read_at: 'read' }),
    notice('unread-chat', '', '', { link: '/messages/person' }),
  ]);
  expect(groups).toHaveLength(3);
  expect(groups.every((g) => g.matchId === null)).toBe(true);
});

test('canonicalises valid match links but never groups list/assignment/external links', () => {
  expect(notificationMatchId({ link: `/matches/${matchA.toUpperCase()}?source=bell` })).toBe(matchA);
  expect(notificationMatchId({ link: `/matches/${matchA}/#events` })).toBe(matchA);
  ['/matches', '/matches/not-an-id', `/commissioner/match-center/live/${matchA}`, `https://example.com/matches/${matchA}`, `/matches/${matchA}/unrelated`].forEach((link) => expect(notificationMatchId({ link })).toBeNull());
});

test('deduplicates paged notifications without losing read state', () => {
  const unread = notice('same', matchA, '2026-09-22T10:00:00Z');
  const group = groupNotifications([unread, { ...unread, read_at: 'read' }])[0];
  expect(group.events).toHaveLength(1);
  expect(group.unread).toBe(0);
});
