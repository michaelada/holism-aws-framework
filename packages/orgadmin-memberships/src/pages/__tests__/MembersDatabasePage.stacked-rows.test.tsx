import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithI18n, screen, within } from '../../test/i18n-test-utils';
import { MemoryRouter } from 'react-router-dom';
import MembersDatabasePage from '../MembersDatabasePage';

/**
 * Below `md` the members table becomes one record per row.
 *
 * A 997px, ten-column table in a 390px window is not a table any more: nine
 * columns sit off-screen behind a horizontal scroll, under a pinned Actions
 * column that covers the name while you drag. The stacked layout keeps every
 * column and reads them down the row instead of across it.
 *
 * These tests drive the breakpoint through `matchMedia`, which is what
 * `useMediaQuery` reads. The shared setup answers `matches: false` for every
 * query — that is why the rest of the suite exercises the desktop table — so
 * this file overrides it per test rather than changing it for everyone.
 */

vi.mock('@aws-web-framework/orgadmin-shell', async () => {
  const { shellMock } = await import('../../test/shell-mock');
  return shellMock();
});

// `vi.hoisted`, because the mock factory below is lifted above this file's
// top-level code and would otherwise read MEMBERS before it exists (§3.4).
const { MEMBERS } = vi.hoisted(() => ({ MEMBERS: [
  {
    id: 'm1',
    firstName: 'Aoife',
    lastName: 'McNamara',
    name: 'Aoife McNamara',
    membershipNumber: '400009',
    membershipTypeId: 't1',
    membershipTypeName: 'Associate Member',
    status: 'pending',
    dateLastRenewed: '2026-08-16',
    validUntil: '2027-08-11',
    labels: ['Associate', 'Non-riding'],
    processed: false,
  },
] }));

vi.mock('@aws-web-framework/orgadmin-core', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { coreMock } = await import('../../test/core-mock');
  return { ...actual, ...coreMock({ responses: { '/members': MEMBERS } }) };
});

/** `matches` for any media query the component asks about. */
const setViewportMatches = (matches: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

const renderPage = () =>
  renderWithI18n(
    <MemoryRouter>
      <MembersDatabasePage />
    </MemoryRouter>
  );

describe('MembersDatabasePage — small screens', () => {
  beforeEach(() => {
    setViewportMatches(false);
  });

  it('keeps the table on a wide screen', async () => {
    setViewportMatches(false);
    renderPage();

    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('drops the table below md, so nothing scrolls sideways', async () => {
    setViewportMatches(true);
    renderPage();

    await screen.findByText('Aoife McNamara');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('carries every column of the record into the stacked row', async () => {
    setViewportMatches(true);
    renderPage();

    await screen.findByText('Aoife McNamara');

    // Number and type share a line; the dates keep the names of the columns
    // they came from, because "16 Aug 2026" beside "11 Aug 2027" says nothing
    // about which is the renewal and which is the expiry.
    expect(screen.getByText(/400009/)).toBeInTheDocument();
    expect(screen.getByText(/Associate Member/)).toBeInTheDocument();
    expect(screen.getByText('Date Last Renewed')).toBeInTheDocument();
    expect(screen.getByText('Valid Until')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('Associate')).toBeInTheDocument();
    expect(screen.getByText('Non-riding')).toBeInTheDocument();
  });

  it('names the row actions instead of leaving them as bare icons', async () => {
    setViewportMatches(true);
    renderPage();

    await screen.findByText('Aoife McNamara');

    expect(screen.getByRole('button', { name: /view details/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /processed/i })).toBeInTheDocument();
  });

  it('keeps the row selectable, so batch operations still work', async () => {
    setViewportMatches(true);
    renderPage();

    await screen.findByText('Aoife McNamara');

    // Named after the member — an unlabelled checkbox in a list of people is
    // unusable to a screen reader, which hears "checkbox" nine times.
    const checkbox = screen.getByRole('checkbox', { name: 'Aoife McNamara' });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });
});
