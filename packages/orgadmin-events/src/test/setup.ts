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

// Mock workspace packages
vi.mock('@aws-web-framework/orgadmin-shell', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      language: 'en-GB',
      changeLanguage: vi.fn(),
    },
  }),
  useLocale: () => ({
    locale: 'en-GB',
  }),
  formatDateTime: (date: any, _locale?: string) => String(date),
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
}));

vi.mock('@aws-web-framework/orgadmin-core', () => ({
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
