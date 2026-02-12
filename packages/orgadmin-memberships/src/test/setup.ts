import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import React from 'react';

// Mock CSS imports
vi.mock('react-quill/dist/quill.snow.css', () => ({}));

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock react-quill globally
vi.mock('react-quill', () => ({
  default: (props: any) => {
    return React.createElement('textarea', {
      'data-testid': 'quill-editor',
      value: props.value,
      onChange: (e: any) => props.onChange(e.target.value),
    });
  },
}));

// Mock date-fns to avoid import issues
vi.mock('date-fns', () => ({
  format: (date: Date) => date.toISOString(),
}));

// Mock @mui/x-date-pickers to avoid date-fns internal import issues
vi.mock('@mui/x-date-pickers', () => ({
  DatePicker: (props: any) => {
    return React.createElement('input', {
      'data-testid': 'date-picker',
      type: 'date',
      value: props.value,
      onChange: (e: any) => props.onChange(e.target.value),
    });
  },
  LocalizationProvider: ({ children }: any) => children,
}));

// Mock @mui/x-date-pickers/AdapterDateFns
vi.mock('@mui/x-date-pickers/AdapterDateFns', () => ({
  AdapterDateFns: class AdapterDateFns {},
}));

// Mock @mui/x-date-pickers/LocalizationProvider
vi.mock('@mui/x-date-pickers/LocalizationProvider', () => ({
  LocalizationProvider: ({ children }: any) => children,
}));

// Mock @mui/x-date-pickers/DatePicker
vi.mock('@mui/x-date-pickers/DatePicker', () => ({
  DatePicker: (props: any) => {
    return React.createElement('input', {
      'data-testid': 'date-picker',
      type: 'date',
      value: props.value,
      onChange: (e: any) => props.onChange(e.target.value),
    });
  },
}));

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

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  constructor() {}
  disconnect() {}
  observe() {}
  unobserve() {}
} as any;
