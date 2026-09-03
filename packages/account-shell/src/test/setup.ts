import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

/**
 * `Element.scrollIntoView`, which jsdom does not implement.
 *
 * Two screens scroll to something the URL named — the events list opened at
 * `?event=`, the shop orders list at `?order=` — and both do it from an effect.
 * Without this the call throws *during the effect flush*, which unmounts the
 * tree: the test sees an empty document and a "cannot find the text" failure,
 * with nothing pointing at the missing browser API.
 *
 * A no-op is the right stub. There is no layout in jsdom to scroll, and what
 * these tests are checking is that the right element was singled out, not that
 * the viewport moved.
 */
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no layout in jsdom; nothing to scroll */
  };
}

/**
 * `window.matchMedia`, which jsdom does not implement.
 *
 * Without it MUI's `useMediaQuery` returns false for every query, so the shell
 * always believes it is on a phone and its permanent drawer is never rendered —
 * the desktop layout would be untestable, and the failure looks like a missing
 * element rather than a missing browser API.
 *
 * Queries are evaluated against `setViewportWidth`, so a test can describe the
 * layout it means: `setViewportWidth(400)` for B2, the default for B1.
 */
const DESKTOP_WIDTH = 1280;
let viewportWidth = DESKTOP_WIDTH;

export function setViewportWidth(width: number): void {
  viewportWidth = width;
}

/** Handles the `(min-width: 900px)` / `(max-width: 899.95px)` forms MUI emits. */
function evaluate(query: string): boolean {
  const min = query.match(/min-width:\s*([\d.]+)px/);
  const max = query.match(/max-width:\s*([\d.]+)px/);
  if (min && viewportWidth < parseFloat(min[1])) return false;
  if (max && viewportWidth > parseFloat(max[1])) return false;
  return Boolean(min || max);
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: evaluate(query),
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

afterEach(() => {
  cleanup();
  viewportWidth = DESKTOP_WIDTH;
});
