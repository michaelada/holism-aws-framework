import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
} as any;

/*
 * jsdom implements no object URLs.
 *
 * The ticketing settings screen previews a chosen image from a blob URL, so
 * `URL.createObjectURL` is called during render. Absent, it throws inside the
 * render and the test reports a missing Save button rather than a missing
 * browser API — the same class of gap as `matchMedia` above. Copied from
 * orgadmin-events' setup, which met it first.
 */
if (!URL.createObjectURL) {
  Object.defineProperty(URL, 'createObjectURL', {
    value: () => 'blob:test',
    writable: true,
    configurable: true,
  });
}
if (!URL.revokeObjectURL) {
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: () => undefined,
    writable: true,
    configurable: true,
  });
}
