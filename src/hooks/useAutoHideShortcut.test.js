import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import useAutoHideShortcut from './useAutoHideShortcut';

let container;
let root;
function Probe({ enabled = true, pageKey = 'news', delay = 3000 }) {
  const visible = useAutoHideShortcut(enabled, pageKey, delay);
  return <span data-visible={String(visible)} />;
}
const visible = () => container.firstChild.dataset.visible === 'true';
const advance = (time) => act(() => { jest.advanceTimersByTime(time); });
const trigger = (type, target = window) => act(() => { target.dispatchEvent(new Event(type)); });

beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  jest.useFakeTimers();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});

test('visible on entry, then hidden after exactly three seconds', () => {
  act(() => root.render(<Probe />));
  expect(visible()).toBe(true);
  advance(2999); expect(visible()).toBe(true);
  advance(1); expect(visible()).toBe(false);
});

test.each(['scroll', 'pointerdown', 'keydown', 'focus', 'pageshow'])('%s reveals and resets the full countdown', (event) => {
  act(() => root.render(<Probe />));
  advance(3000); expect(visible()).toBe(false);
  trigger(event); expect(visible()).toBe(true);
  advance(3000); trigger(event);
  advance(2999); expect(visible()).toBe(true);
  advance(1); expect(visible()).toBe(false);
});

test('changing page resets the timer; unrelated pages remove activity listeners', () => {
  act(() => root.render(<Probe pageKey="news" />));
  advance(3000);
  act(() => root.render(<Probe pageKey="social" />));
  advance(2999); expect(visible()).toBe(true);
  advance(1); expect(visible()).toBe(false);
  act(() => root.render(<Probe enabled={false} pageKey="chat" />));
  trigger('pointerdown'); expect(visible()).toBe(false);
  expect(jest.getTimerCount()).toBe(0);
});

test('returning to a visible browser tab reveals the shortcut', () => {
  act(() => root.render(<Probe />));
  advance(3000);
  const original = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
  trigger('visibilitychange', document); expect(visible()).toBe(false);
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
  trigger('visibilitychange', document); expect(visible()).toBe(true);
  if (original) Object.defineProperty(document, 'visibilityState', original);
  else delete document.visibilityState;
});


test('three-second shortcuts and five-second navigation run independently', () => {
  act(() => root.render(<><Probe delay={3000} /><Probe delay={5000} /></>));
  advance(3000);
  expect([...container.children].map((el) => el.dataset.visible)).toEqual(['false', 'true']);
  advance(1999); expect(container.lastChild.dataset.visible).toBe('true');
  advance(1); expect(container.lastChild.dataset.visible).toBe('false');
  trigger('pointerdown');
  expect([...container.children].map((el) => el.dataset.visible)).toEqual(['true', 'true']);
});

test('five-second navigation visibility resets after tapping and scrolling', () => {
  act(() => root.render(<Probe delay={5000} />));
  advance(5000); expect(visible()).toBe(false);
  trigger('pointerdown'); expect(visible()).toBe(true);
  advance(4999); expect(visible()).toBe(true);
  trigger('scroll');
  advance(4999); expect(visible()).toBe(true);
  advance(1); expect(visible()).toBe(false);
});
