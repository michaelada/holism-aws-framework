import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSectionObserver } from '../useSectionObserver';

/**
 * Which section of a long form the operator is currently looking at, so the
 * sidebar can highlight it.
 *
 * The rule that matters is *most visible wins*, not last-reported: while
 * scrolling, several sections intersect at once, and picking the last entry the
 * observer happened to deliver makes the highlight jump around. The other half
 * is bookkeeping — a section that unmounts must stop being observed and must
 * drop its recorded ratio, or the sidebar keeps highlighting a section that is
 * no longer on the page.
 */

type Entry = { id: string; ratio: number; intersecting?: boolean };

let observed: Set<Element>;
let notify: (entries: unknown[]) => void;
let disconnected: number;

/** A stand-in observer whose callback the test drives directly. */
class FakeObserver {
  constructor(callback: (entries: unknown[]) => void) {
    notify = callback;
  }
  observe(el: Element) {
    observed.add(el);
  }
  unobserve(el: Element) {
    observed.delete(el);
  }
  disconnect() {
    disconnected += 1;
    observed.clear();
  }
}

const section = (id: string) => {
  const el = document.createElement('section');
  el.setAttribute('id', id);
  document.body.appendChild(el);
  return el;
};

/** Report intersection ratios the way the browser would. */
const scrollTo = (entries: Entry[]) =>
  act(() => {
    notify(
      entries.map((e) => ({
        target: document.getElementById(e.id)!,
        isIntersecting: e.intersecting ?? e.ratio > 0,
        intersectionRatio: e.ratio,
      }))
    );
  });

beforeEach(() => {
  observed = new Set();
  disconnected = 0;
  vi.stubGlobal('IntersectionObserver', FakeObserver);
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('useSectionObserver — before anything is visible', () => {
  it('highlights nothing', () => {
    const { result } = renderHook(() => useSectionObserver());

    expect(result.current.activeSectionId).toBeNull();
  });

  it('watches a section as soon as it is registered', () => {
    const { result } = renderHook(() => useSectionObserver());
    const el = section('basics');

    act(() => result.current.registerSection('basics', el));

    expect(observed.has(el)).toBe(true);
  });

  it('picks up sections registered before the observer existed', () => {
    const el = section('basics');
    const { result } = renderHook(() => useSectionObserver());

    // The first render registers refs before the effect has run.
    act(() => result.current.registerSection('basics', el));

    expect(result.current.sectionRefs.current.get('basics')).toBe(el);
  });
});

describe('useSectionObserver — deciding which section is current', () => {
  it('highlights the section that is on screen', () => {
    const { result } = renderHook(() => useSectionObserver());
    act(() => result.current.registerSection('basics', section('basics')));

    scrollTo([{ id: 'basics', ratio: 0.9 }]);

    expect(result.current.activeSectionId).toBe('basics');
  });

  it('picks the most visible of several, not the last one reported', () => {
    const { result } = renderHook(() => useSectionObserver());
    act(() => {
      result.current.registerSection('basics', section('basics'));
      result.current.registerSection('dates', section('dates'));
    });

    // `dates` arrives last but is barely on screen.
    scrollTo([
      { id: 'basics', ratio: 0.8 },
      { id: 'dates', ratio: 0.2 },
    ]);

    expect(result.current.activeSectionId).toBe('basics');
  });

  it('follows the reader as the balance shifts', () => {
    const { result } = renderHook(() => useSectionObserver());
    act(() => {
      result.current.registerSection('basics', section('basics'));
      result.current.registerSection('dates', section('dates'));
    });

    scrollTo([
      { id: 'basics', ratio: 0.8 },
      { id: 'dates', ratio: 0.2 },
    ]);
    scrollTo([
      { id: 'basics', ratio: 0.3 },
      { id: 'dates', ratio: 0.7 },
    ]);

    expect(result.current.activeSectionId).toBe('dates');
  });

  it('treats a section that has scrolled out as not visible at all', () => {
    const { result } = renderHook(() => useSectionObserver());
    act(() => result.current.registerSection('basics', section('basics')));

    scrollTo([{ id: 'basics', ratio: 0.9 }]);
    // A stale ratio on a section that has left the viewport keeps it highlighted.
    scrollTo([{ id: 'basics', ratio: 0.9, intersecting: false }]);

    expect(result.current.activeSectionId).toBeNull();
  });

  it('ignores an element with no id, which it could not name anyway', () => {
    const { result } = renderHook(() => useSectionObserver());
    const anonymous = document.createElement('div');
    document.body.appendChild(anonymous);

    act(() => notify([{ target: anonymous, isIntersecting: true, intersectionRatio: 1 }]));

    expect(result.current.activeSectionId).toBeNull();
  });
});

describe('useSectionObserver — sections coming and going', () => {
  it('stops watching a section that has been removed', () => {
    const { result } = renderHook(() => useSectionObserver());
    const el = section('dates');
    act(() => result.current.registerSection('dates', el));

    act(() => result.current.registerSection('dates', null));

    expect(observed.has(el)).toBe(false);
    expect(result.current.sectionRefs.current.has('dates')).toBe(false);
  });

  it('forgets a removed section’s visibility rather than highlighting it forever', () => {
    const { result } = renderHook(() => useSectionObserver());
    act(() => {
      result.current.registerSection('basics', section('basics'));
      result.current.registerSection('dates', section('dates'));
    });
    scrollTo([
      { id: 'basics', ratio: 0.2 },
      { id: 'dates', ratio: 0.9 },
    ]);

    act(() => result.current.registerSection('dates', null));
    scrollTo([{ id: 'basics', ratio: 0.2 }]);

    // Left behind, `dates` would keep winning on a ratio nobody can see.
    expect(result.current.activeSectionId).toBe('basics');
  });

  it('swaps the element when a section re-renders into a new node', () => {
    const { result } = renderHook(() => useSectionObserver());
    const first = section('basics');
    act(() => result.current.registerSection('basics', first));

    document.body.removeChild(first);
    const second = section('basics');
    act(() => result.current.registerSection('basics', second));

    expect(observed.has(first)).toBe(false);
    expect(observed.has(second)).toBe(true);
  });

  it('does nothing when the same element is registered twice', () => {
    const { result } = renderHook(() => useSectionObserver());
    const el = section('basics');
    act(() => result.current.registerSection('basics', el));

    act(() => result.current.registerSection('basics', el));

    // React calls ref callbacks on every render; re-observing each time would
    // churn the observer for no reason.
    expect(observed.size).toBe(1);
  });

  it('shrugs at being asked to remove a section it never had', () => {
    const { result } = renderHook(() => useSectionObserver());

    expect(() => act(() => result.current.registerSection('never-there', null))).not.toThrow();
  });
});

describe('useSectionObserver — leaving the page', () => {
  it('disconnects the observer when the page unmounts', () => {
    const { unmount } = renderHook(() => useSectionObserver());

    unmount();

    // An observer left connected keeps firing into an unmounted component.
    expect(disconnected).toBe(1);
  });
});
