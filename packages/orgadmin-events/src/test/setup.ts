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
 * Mock workspace packages.
 *
 * The shell stand-in comes from `orgadmin-core/test/shellMock`, which mirrors
 * the shell's whole export surface. This file used to list only the four hooks
 * the pages needed when it was written, so the day `usePageHelp` and
 * `useOnboarding` appeared on those pages, every suite in this package died
 * with "No `usePageHelp` export is defined on the mock". Only the two
 * formatters are overridden below, because assertions here read the raw value.
 */
vi.mock('@itsplainsailing/orgadmin-shell', async () => {
  const { createShellMock } = await import('@itsplainsailing/orgadmin-core/test/shellMock');
  return {
    ...createShellMock(),
    formatDateTime: (date: any, _locale?: string) => String(date),
    formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  };
});

/*
 * Only `useApi` and `useOrganisation` are replaced; everything else in
 * orgadmin-core comes through untouched. Listing exports by hand here meant
 * that `AuthTokenContext` — read by `useDiscountService`, which the events
 * pages call — was simply absent, and `useContext(undefined)` took the page
 * down before any assertion ran.
 */
vi.mock('@itsplainsailing/orgadmin-core', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useApi: vi.fn(() => ({
    execute: vi.fn(),
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  })),
  useOrganisation: vi.fn(() => ({
    organisation: { id: 'test-org', name: 'Test Organisation' },
    setOrganisation: vi.fn(),
  })),
}));

/*
 * jsdom implements no object URLs.
 *
 * A page that downloads a file calls `URL.createObjectURL`, which is simply
 * absent here — the call throws inside the click handler, and the test reports
 * whatever the page failed to render rather than the missing browser API. Same
 * class of gap as `matchMedia` above.
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
