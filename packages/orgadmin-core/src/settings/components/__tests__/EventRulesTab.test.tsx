import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import EventRulesTab from '../EventRulesTab';
import * as useApiModule from '../../../hooks/useApi';
import * as organisationModule from '../../../context/OrganisationContext';
import { resolveTranslation } from '../../../test/i18nTestUtils';

/**
 * S0-6 — a club's own event rules.
 *
 * Four properties carry the design, and each is a way for a club to be quietly
 * misled about why its events run the way they do.
 *
 *  - **The `From` column on every row.** "Where did 20 minutes come from?" is
 *    the only question anybody asks of an inheritance chain, and the club
 *    cannot work the answer out — it cannot see its federation's row.
 *  - **A locked setting is removed, not greyed out.** A disabled control
 *    explains nothing; a sentence naming who set it explains everything. That
 *    is ORGANISATION_TYPE_LOGO.md's rule.
 *  - **Only differences are sent.** Posting the resolved values back would
 *    freeze the club on whatever it inherited that day.
 *  - **A refusal shows the API's own words**, which name the key refused.
 */

vi.mock('../../../hooks/useApi');
vi.mock('../../../context/OrganisationContext');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en-GB' },
  }),
}));

const label = (key: string, options?: Record<string, unknown>) =>
  resolveTranslation(key, options);

const TEMPLATES = [
  {
    id: 'tpl-1',
    key: 'equestrian.eventing',
    displayName: 'Eventing',
    shape: { settingLabels: { 'minutesPerCompetitor.xc': 'Cross country' } },
  },
];

const rules = (over: Record<string, unknown> = {}) => ({
  templateId: 'tpl-1',
  templateKey: 'equestrian.eventing',
  settings: {
    competitorGapMinutes: 20,
    objectionsWindow: 30,
    'minutesPerCompetitor.xc': 6,
  },
  sources: {
    competitorGapMinutes: 'organisation-type',
    objectionsWindow: 'template',
    'minutesPerCompetitor.xc': 'template',
  },
  locked: [],
  ...over,
});

const mockExecute = vi.fn();

/** Templates first, then the rules for the selected one. */
const answerWith = (resolved: Record<string, unknown>) => {
  mockExecute.mockReset();
  mockExecute.mockImplementation(async ({ url, method }: any) => {
    if (url.includes('/event-templates')) return TEMPLATES;
    if (method === 'PUT') return resolved;
    return resolved;
  });
};

const renderTab = () => render(<EventRulesTab />);

beforeEach(() => {
  vi.clearAllMocks();
  answerWith(rules());
  vi.mocked(useApiModule.useApi).mockReturnValue({
    execute: mockExecute,
    data: null,
    error: null,
    loading: false,
    reset: vi.fn(),
  } as any);
  vi.mocked(organisationModule.useOrganisation).mockReturnValue({
    organisation: {
      id: 'org-1',
      organizationType: { id: 'ot-1', name: 'ipc', displayName: 'Irish Pony Club' },
    },
  } as any);
});

describe('the From column', () => {
  it('names the level each value came from', async () => {
    renderTab();

    const row = (await screen.findByText('Competitor gap minutes')).closest('tr')!;
    expect(
      within(row).getByText(label('settings.eventRules.from.organisationType'))
    ).toBeInTheDocument();

    const inherited = screen.getByText('Objections window').closest('tr')!;
    expect(
      within(inherited).getByText(label('settings.eventRules.from.template'))
    ).toBeInTheDocument();
  });

  it('prefers the wording the template supplies over the humanised key', async () => {
    renderTab();

    expect(await screen.findByText('Cross country')).toBeInTheDocument();
    expect(screen.queryByText('Xc')).not.toBeInTheDocument();
  });
});

describe('a locked setting', () => {
  it('has no input at all, and says who set it', async () => {
    // Removed, not disabled. A club left clicking at a dead control concludes
    // the product is broken.
    answerWith(rules({ locked: ['competitorGapMinutes'] }));
    renderTab();

    const row = (await screen.findByText('Competitor gap minutes')).closest('tr')!;
    expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      within(row).getByText(label('settings.eventRules.lockedBy', { name: 'Irish Pony Club' }))
    ).toBeInTheDocument();
  });

  it('still shows the value, so the club knows what the rule is', async () => {
    answerWith(rules({ locked: ['competitorGapMinutes'] }));
    renderTab();

    const row = (await screen.findByText('Competitor gap minutes')).closest('tr')!;
    expect(within(row).getByText('20')).toBeInTheDocument();
  });

  it('falls back to naming the organisation type generically when it has no name', async () => {
    vi.mocked(organisationModule.useOrganisation).mockReturnValue({
      organisation: { id: 'org-1' },
    } as any);
    answerWith(rules({ locked: ['competitorGapMinutes'] }));
    renderTab();

    const row = (await screen.findByText('Competitor gap minutes')).closest('tr')!;
    expect(
      within(row).getByText(label('settings.eventRules.lockedByType'))
    ).toBeInTheDocument();
  });

  it('is never sent, even alongside a setting that is being changed', async () => {
    // Sending a locked key would turn an unrelated save into a 403.
    answerWith(rules({ locked: ['competitorGapMinutes'] }));
    renderTab();

    const row = (await screen.findByText('Objections window')).closest('tr')!;
    fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: label('common.actions.save') }));

    await waitFor(() =>
      expect(mockExecute.mock.calls.some(([options]) => options.method === 'PUT')).toBe(true)
    );
    const put = mockExecute.mock.calls.find(([options]) => options.method === 'PUT')![0];
    expect(put.data.settings).toEqual({ objectionsWindow: 45 });
  });
});

describe('saving', () => {
  it('sends only what this club changed, not the values it inherited', async () => {
    renderTab();

    const row = (await screen.findByText('Objections window')).closest('tr')!;
    fireEvent.change(within(row).getByRole('spinbutton'), { target: { value: '45' } });
    fireEvent.click(screen.getByRole('button', { name: label('common.actions.save') }));

    await waitFor(() =>
      expect(mockExecute.mock.calls.some(([options]) => options.method === 'PUT')).toBe(true)
    );
    const put = mockExecute.mock.calls.find(([options]) => options.method === 'PUT')![0];
    // Not competitorGapMinutes, which came from the type and was untouched.
    expect(put.data.settings).toEqual({ objectionsWindow: 45 });
  });

  it('keeps an override the club had already made', async () => {
    answerWith(
      rules({
        sources: {
          competitorGapMinutes: 'organisation',
          objectionsWindow: 'template',
          'minutesPerCompetitor.xc': 'template',
        },
      })
    );
    renderTab();

    await screen.findByText('Competitor gap minutes');
    fireEvent.click(screen.getByRole('button', { name: label('common.actions.save') }));

    await waitFor(() =>
      expect(mockExecute.mock.calls.some(([options]) => options.method === 'PUT')).toBe(true)
    );
    const put = mockExecute.mock.calls.find(([options]) => options.method === 'PUT')![0];
    expect(put.data.settings).toEqual({ competitorGapMinutes: 20 });
  });

  it('shows the API’s own words when a save is refused', async () => {
    // The refusal names the key, which "Could not save" would not.
    renderTab();
    await screen.findByText('Objections window');

    mockExecute.mockRejectedValueOnce(
      new Error('"competitorGapMinutes" is fixed by your organisation type')
    );
    fireEvent.click(screen.getByRole('button', { name: label('common.actions.save') }));

    expect(
      await screen.findByText(/is fixed by your organisation type/i)
    ).toBeInTheDocument();
  });
});

describe('resetting', () => {
  it('offers a reset only on a row this club has changed', async () => {
    renderTab();

    const inherited = (await screen.findByText('Objections window')).closest('tr')!;
    expect(within(inherited).queryByRole('button')).not.toBeInTheDocument();

    fireEvent.change(within(inherited).getByRole('spinbutton'), { target: { value: '45' } });
    expect(within(inherited).getByRole('button')).toBeInTheDocument();
  });

  it('removes the club’s value rather than writing the inherited one back', async () => {
    // Sending the inherited value would look identical and behave differently:
    // the club would stop following a later improvement to the default.
    answerWith(
      rules({
        sources: {
          competitorGapMinutes: 'organisation',
          objectionsWindow: 'template',
          'minutesPerCompetitor.xc': 'template',
        },
      })
    );
    renderTab();

    const row = (await screen.findByText('Competitor gap minutes')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button'));
    fireEvent.click(screen.getByRole('button', { name: label('common.actions.save') }));

    await waitFor(() =>
      expect(mockExecute.mock.calls.some(([options]) => options.method === 'PUT')).toBe(true)
    );
    const put = mockExecute.mock.calls.find(([options]) => options.method === 'PUT')![0];
    expect(put.data.settings).toEqual({});
  });

  it('resets every row at once', async () => {
    answerWith(
      rules({
        sources: {
          competitorGapMinutes: 'organisation',
          objectionsWindow: 'organisation',
          'minutesPerCompetitor.xc': 'template',
        },
      })
    );
    renderTab();

    await screen.findByText('Competitor gap minutes');
    fireEvent.click(screen.getByRole('button', { name: label('settings.eventRules.resetAll') }));
    fireEvent.click(screen.getByRole('button', { name: label('common.actions.save') }));

    await waitFor(() =>
      expect(mockExecute.mock.calls.some(([options]) => options.method === 'PUT')).toBe(true)
    );
    const put = mockExecute.mock.calls.find(([options]) => options.method === 'PUT')![0];
    expect(put.data.settings).toEqual({});
  });
});

describe('when there is nothing to show', () => {
  it('says so when no discipline has been made available', async () => {
    mockExecute.mockReset();
    mockExecute.mockResolvedValue([]);
    renderTab();

    expect(await screen.findByText(label('settings.eventRules.noTemplates'))).toBeInTheDocument();
  });

  it('reports a failed load rather than showing an empty table', async () => {
    mockExecute.mockReset();
    mockExecute.mockRejectedValue(new Error('network'));
    renderTab();

    expect(await screen.findByText(/network/i)).toBeInTheDocument();
  });
});
