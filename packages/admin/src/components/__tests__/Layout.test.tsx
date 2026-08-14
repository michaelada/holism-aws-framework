import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { Layout } from '../Layout';
import { defaultTheme } from '../../theme';

// The shared setup stubs `matchMedia` to match nothing, which puts the shell in
// its narrow layout where the rail lives behind a hamburger. These assertions
// are about the desktop rail, so this file answers `min-width` queries true.
beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('min-width'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

const renderLayout = (initialPath = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <ThemeProvider theme={defaultTheme}>
        <Layout onLogout={vi.fn()} userName="ops@eskersoft.com">
          <h1>Content</h1>
        </Layout>
      </ThemeProvider>
    </MemoryRouter>
  );

describe('Layout navigation', () => {
  /**
   * The regression this suite exists for: the old AppBar listed three of the
   * router's destinations. Users and Roles were fully built and reachable only
   * by typing a URL that appeared nowhere in the interface.
   */
  it.each([
    'Dashboard',
    'Organisation Types',
    'Organisations',
    'Users',
    'Roles',
  ])('offers %s in the navigation', (label) => {
    renderLayout();
    expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
  });

  it('does not offer Tenants, which the schema never implemented', () => {
    renderLayout();
    expect(screen.queryByRole('button', { name: 'Tenants' })).not.toBeInTheDocument();
  });

  it('groups the destinations under headings', () => {
    renderLayout();
    expect(screen.getByRole('heading', { name: 'Platform' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Configuration' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Access' })).toBeInTheDocument();
  });

  it('marks the current section for assistive technology, not just visually', () => {
    renderLayout('/organizations');
    expect(screen.getByRole('button', { name: 'Organisations' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('button', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('keeps a section current while inside one of its detail pages', () => {
    renderLayout('/organizations/abc-123/edit');
    expect(screen.getByRole('button', { name: 'Organisations' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });

  it('provides the landmarks and skip link a keyboard user needs', () => {
    renderLayout();
    expect(screen.getByRole('navigation', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByText('Skip to main content')).toHaveAttribute('href', '#main-content');
  });
});

describe('Layout branding', () => {
  it('shows the mark beside the wordmark', () => {
    const { container } = renderLayout();
    const mark = container.querySelector('img[src="/logo.png"]');
    expect(mark).toBeInTheDocument();
    expect(screen.getByText('Its Plain Sailing')).toBeInTheDocument();
  });

  it('reserves space for the mark so the rail does not reflow as it loads', () => {
    const { container } = renderLayout();
    const mark = container.querySelector('img[src="/logo.png"]');
    expect(mark).toHaveAttribute('width', '28');
    expect(mark).toHaveAttribute('height', '32');
  });

  it('leaves the mark decorative, since the wordmark already says the name', () => {
    // An announced logo immediately before the words "Its Plain Sailing" says
    // the brand twice and tells a screen-reader user nothing.
    const { container } = renderLayout();
    expect(container.querySelector('img[src="/logo.png"]')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img', { name: /Its Plain Sailing/ })).not.toBeInTheDocument();
  });
});
