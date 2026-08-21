import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';

/**
 * A club's own audit trail.
 *
 * The property that matters most is the one that is not visible on screen: this
 * page must never be able to ask for another organisation's events. The server
 * fixes the scope, and the test below asserts that the page does not send one —
 * a page that passed `organisationId` would still work today and would be a
 * tenancy hole the day the server started trusting it.
 *
 * The rest is about the distinctions a careless list would collapse: a failed
 * load against an empty result, and a denied action against a successful one.
 */

const { execute, organisation } = vi.hoisted(() => ({
  execute: vi.fn(),
  // A stable reference. The page reloads in an effect keyed on identity, so a
  // fresh object per render loops for ever and the test times out.
  organisation: { id: 'org-1', name: 'Kildare Hunt Pony Club' },
}));

vi.mock('../../../hooks/useApi', () => ({ useApi: () => ({ execute }) }));
vi.mock('../../../context/OrganisationContext', () => ({
  useOrganisation: () => ({ organisation }),
}));
const resources = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    /*
     * Behaves like i18next with nothing translated: a `defaultValue` wins, and
     * a bare key comes back as itself. That is the interesting case here — it
     * is what exercises the label fallback chain rather than short-circuiting
     * it, and it is what a locale that has not caught up will actually do.
     */
    t: (key: string, options?: { defaultValue?: string }) =>
      options && 'defaultValue' in options ? options.defaultValue : key,
    // The label probes read resources directly rather than through `t`, so a
    // key holding an object cannot leak i18next's diagnostic onto the screen.
    i18n: {
      language: 'en-GB',
      resolvedLanguage: 'en-GB',
      getResource: (_lng: string, _ns: string, key: string) => resources.current[key],
    },
  }),
}));
vi.mock('@aws-web-framework/components', async () => ({
  // The label maps are real: they are the English fallback the page relies on.
  ...(await vi.importActual<Record<string, unknown>>('../../../../../components/src/utils/auditLabels')),
  AuditChanges: ({ changes, formatField }: { changes: any; formatField?: (f: string) => string }) => (
    <div data-testid="changes">
      {JSON.stringify(changes)}
      {formatField && (
        <span data-testid="field-label">
          {Object.keys(changes ?? { openDateEntries: 1 }).map(formatField).join(' | ')}
        </span>
      )}
    </div>
  ),
}));

import { AuditLogPage } from '../AuditLogPage';

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  occurredAt: '2026-08-21T10:10:33Z',
  actorDisplay: 'Aoife Byrne',
  actorEmail: 'admin@kildarehunt.test',
  actorUserType: 'org-admin',
  organisationName: 'Kildare Hunt Pony Club',
  category: 'settings',
  action: 'settings.branding-updated',
  outcome: 'success',
  entityType: 'branding-settings',
  entityLabel: 'Branding',
  changes: { primaryColor: { from: '#1976d2', to: '#aa0000' } },
  context: null,
  ...over,
});

/** Answers the list and the filter-options call by URL. */
const respond = (page: unknown, filters: unknown = { categories: [], actions: [], earliest: null }) =>
  execute.mockImplementation(({ url }: { url: string }) =>
    Promise.resolve(url.includes('/filters') ? filters : page)
  );

const urls = () => execute.mock.calls.map((call) => String(call[0].url));

beforeEach(() => {
  vi.clearAllMocks();
  resources.current = {};
  respond({ events: [], nextCursor: null });
});

describe('scope', () => {
  it('never names an organisation in the request', async () => {
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    await screen.findByText('Branding changed');

    for (const url of urls()) {
      expect(url).toContain('/api/orgadmin/organisation/audit');
      expect(url).not.toMatch(/organisation_?[Ii]d=/);
    }
  });
});

describe('the list', () => {
  it('shows who did what', async () => {
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    expect(await screen.findByText('Aoife Byrne')).toBeInTheDocument();
    expect(screen.getByText('Branding changed')).toBeInTheDocument();
    expect(screen.getByText('Branding')).toBeInTheDocument();
  });

  it('names an unattributed actor rather than leaving a blank', async () => {
    respond({ events: [event({ actorDisplay: null })], nextCursor: null });
    render(<AuditLogPage />);

    expect(await screen.findByText('audit.unknownActor')).toBeInTheDocument();
  });

  it('flags an outcome that was not success', async () => {
    respond({ events: [event({ outcome: 'denied' })], nextCursor: null });
    render(<AuditLogPage />);

    expect(await screen.findByText('audit.outcomes.denied')).toBeInTheDocument();
  });

  it('says nothing extra about a successful action', async () => {
    // A chip on every row would make the interesting ones invisible.
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    await screen.findByText('Aoife Byrne');
    expect(screen.queryByText('audit.outcomes.success')).not.toBeInTheDocument();
  });
});

describe('empty against broken', () => {
  it('shows the empty state when there is genuinely nothing', async () => {
    render(<AuditLogPage />);
    expect(await screen.findByText('audit.empty')).toBeInTheDocument();
    expect(screen.queryByText('audit.loadError')).not.toBeInTheDocument();
  });

  it('shows an error when the load failed', async () => {
    /*
     * `useApi.execute` resolves to null on failure rather than throwing, so
     * without the onError hook a failed load and an empty log are the same
     * screen — and the reader concludes nothing has happened.
     */
    execute.mockImplementation(({ url, onError }: { url: string; onError?: () => void }) => {
      if (url.includes('/filters')) return Promise.resolve({ categories: [], actions: [] });
      onError?.();
      return Promise.resolve(null);
    });

    render(<AuditLogPage />);

    expect(await screen.findByText('audit.loadError')).toBeInTheDocument();
    expect(screen.queryByText('audit.empty')).not.toBeInTheDocument();
  });
});

describe('paging', () => {
  it('offers older events only while there are some', async () => {
    respond({ events: [event()], nextCursor: '2026-08-01T00:00:00Z|e0' });
    render(<AuditLogPage />);

    expect(await screen.findByText('audit.loadOlder')).toBeInTheDocument();
  });

  it('says so when the end is reached', async () => {
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    expect(await screen.findByText('audit.noMore')).toBeInTheDocument();
  });

  it('appends rather than replacing when loading older events', async () => {
    respond({ events: [event()], nextCursor: 'cursor-1' });
    render(<AuditLogPage />);

    const older = await screen.findByText('audit.loadOlder');

    respond({ events: [event({ id: 'e2', action: 'auth.login' })], nextCursor: null });
    fireEvent.click(older);

    await waitFor(() => expect(screen.getByText('Signed in')).toBeInTheDocument());
    expect(screen.getByText('Branding changed')).toBeInTheDocument();
  });
});

describe('filters', () => {
  it('sends the search term', async () => {
    render(<AuditLogPage />);
    await screen.findByText('audit.empty');

    fireEvent.change(screen.getByPlaceholderText('audit.searchPlaceholder'), {
      target: { value: 'KHP-0241' },
    });
    fireEvent.click(screen.getByText('audit.search'));

    await waitFor(() => expect(urls().some((url) => url.includes('q=KHP-0241'))).toBe(true));
  });

  it('offers to clear only once something is filtered', async () => {
    render(<AuditLogPage />);
    await screen.findByText('audit.empty');

    expect(screen.queryByText('audit.clearAll')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('audit.searchPlaceholder'), {
      target: { value: 'anything' },
    });
    fireEvent.click(screen.getByText('audit.search'));

    expect(await screen.findByText('audit.clearAll')).toBeInTheDocument();
  });
});

describe('names a reader knows', () => {
  it('shows the action in words, not as an identifier', async () => {
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    expect(await screen.findByText('Branding changed')).toBeInTheDocument();
    expect(screen.queryByText('settings.branding-updated')).not.toBeInTheDocument();
  });

  it('falls back to readable English when a locale has not translated an action', async () => {
    /*
     * The English label is passed to `t()` as `defaultValue`, so a missing
     * translation degrades to "Signed in" rather than to the raw key. A locale
     * catching up later changes the screen and nothing else.
     */
    respond({ events: [event({ action: 'auth.login' })], nextCursor: null });
    render(<AuditLogPage />);

    expect(await screen.findByText('Signed in')).toBeInTheDocument();
  });

  it('keeps the identifier as the filter value, only the display changes', async () => {
    respond({ events: [event()], nextCursor: null }, {
      categories: [],
      actions: ['settings.branding-updated'],
      earliest: null,
    });
    render(<AuditLogPage />);
    await screen.findByText('Branding changed');

    // MUI Select opens on mouseDown, not click.
    fireEvent.mouseDown(screen.getByLabelText('audit.action'));
    const listbox = await screen.findByRole('listbox');
    fireEvent.click(within(listbox).getByText('Branding changed'));

    // The option reads "Branding changed" and still filters by the stored id.
    await waitFor(() =>
      expect(urls().some((url) => url.includes('action=settings.branding-updated'))).toBe(true)
    );
  });

it('prefers a translation over the English fallback when there is one', async () => {
    resources.current['audit.actions.settings.branding-updated'] = 'Identité visuelle modifiée';
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    expect(await screen.findByText('Identité visuelle modifiée')).toBeInTheDocument();
  });

  it('ignores a namespace key that holds an object rather than a label', async () => {
    /*
     * `events.basicInfo.validation` is a group of messages, and a form field
     * named `validation` collided with it. Probed through `t()` this put
     * i18next's own diagnostic — "returned an object instead of string" — on
     * the screen as if it were a field name.
     */
    resources.current['events.basicInfo.validation'] = { nameRequired: 'Name is required' };
    respond({ events: [event({ changes: { validation: { from: null, to: 'x' } } })], nextCursor: null });
    render(<AuditLogPage />);

    fireEvent.click(await screen.findByText('Aoife Byrne'));
    const label = await screen.findByTestId('field-label');

    expect(label.textContent).not.toContain('returned an object');
  });

  it('gives the changes renderer a field labeller', async () => {
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    fireEvent.click(await screen.findByText('Aoife Byrne'));

    // No namespace translates `primaryColor` in this test, so the curated
    // English label wins over the raw column name.
    expect(await screen.findByTestId('field-label')).toHaveTextContent('Primary colour');
  });
});

describe('the detail', () => {
  it('opens the changes for the row that was clicked', async () => {
    respond({ events: [event()], nextCursor: null });
    render(<AuditLogPage />);

    fireEvent.click(await screen.findByText('Aoife Byrne'));

    const changes = await screen.findByTestId('changes');
    expect(changes.textContent).toContain('#aa0000');
  });
});
