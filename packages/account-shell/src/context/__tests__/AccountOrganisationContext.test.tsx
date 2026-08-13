import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import {
  AccountOrganisationProvider,
  useAccountOrganisation,
} from '../AccountOrganisationContext';
import { AccountApiError } from '../../hooks/useAccountApi';
import { TEST_ME, TEST_PUBLIC_DETAIL } from '../../test/renderWithProviders';

/**
 * `useAccountApi` is mocked rather than axios, so these tests describe how the
 * context reacts to each API outcome without asserting on transport details.
 *
 * `execute` is a single stable mock shared by both calls the provider makes
 * (`/me` and the public record) and dispatches on the URL — the provider keys
 * effects on `execute` identity, so handing back a fresh function per hook call
 * would loop forever instead of failing (CLAUDE.md §3.4).
 */
const mockExecute = vi.fn();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

const Probe: React.FC = () => {
  const { state, capabilities, hasCapability, primaryColor } = useAccountOrganisation();
  return (
    <div>
      <span data-testid="state">{state}</span>
      <span data-testid="capabilities">{capabilities.join(',')}</span>
      <span data-testid="has-events">{String(hasCapability('event-management'))}</span>
      <span data-testid="primary">{primaryColor ?? 'none'}</span>
    </div>
  );
};

const renderProvider = (orgCode: string | null, authenticated: boolean) =>
  render(
    <AccountOrganisationProvider orgCode={orgCode} authenticated={authenticated}>
      <Probe />
    </AccountOrganisationProvider>
  );

/** Route by URL so both of the provider's requests can be answered. */
const respond = (me: unknown | AccountApiError) => {
  mockExecute.mockImplementation((request: { url: string }) => {
    if (request.url.startsWith('/api/public/')) {
      return Promise.resolve(TEST_PUBLIC_DETAIL);
    }
    return me instanceof Error ? Promise.reject(me) : Promise.resolve(me);
  });
};

describe('AccountOrganisationProvider', () => {
  beforeEach(() => {
    mockExecute.mockReset();
  });

  it('resolves a member of the organisation to connected', async () => {
    respond(TEST_ME);
    renderProvider('khpc', true);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'));
    expect(screen.getByTestId('capabilities')).toHaveTextContent('event-management,memberships');
  });

  it('treats a signed-out visitor as anonymous without calling the member API', async () => {
    respond(TEST_ME);
    renderProvider('khpc', false);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('anonymous'));

    // The public record is still fetched — the gateway needs it — but /me is
    // not, because there is no session to authenticate it with.
    const urls = mockExecute.mock.calls.map((call) => call[0].url);
    expect(urls.every((url: string) => url.startsWith('/api/public/'))).toBe(true);
  });

  /**
   * Each refusal code is a different screen, so the mapping is the part worth
   * pinning down — collapsing any two of these would send a member to the wrong
   * place with no error to show for it.
   */
  it.each([
    ['NOT_CONNECTED', 'not-connected'],
    ['PENDING_APPROVAL', 'pending'],
    ['REGISTRATION_REJECTED', 'rejected'],
    ['ACCOUNT_INACTIVE', 'inactive'],
    ['ORGANISATION_UNAVAILABLE', 'unavailable'],
  ])('maps %s to the %s state', async (code, expected) => {
    respond(new AccountApiError('refused', 403, code));
    renderProvider('khpc', true);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent(expected));
  });

  /**
   * A 2xx is not proof the API answered.
   *
   * When another process answers this origin — a dev proxy pointed at the wrong
   * server, a captive portal, an HTML error page — `execute` resolves with a
   * body that is not this payload. Storing it puts a string where every
   * consumer expects an object, and the first `me.organisation` dereference
   * blanks the whole app with a stack trace: the least useful failure available,
   * and one that hides the actual cause.
   */
  it.each([
    ['an HTML page', '<!doctype html><html><body>not the API</body></html>'],
    ['a payload with no organisation', { user: { id: 'u1' } }],
    ['a payload with no user', { organisation: { capabilities: [] } }],
    ['null', null],
  ])('treats %s from /me as unavailable rather than crashing', async (_label, body) => {
    respond(body);
    renderProvider('khpc', true);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('unavailable'));
    // No capabilities, and asking about one must not throw.
    expect(screen.getByTestId('capabilities')).toHaveTextContent('');
    expect(screen.getByTestId('has-events')).toHaveTextContent('false');
  });

  it('falls back to unavailable for an unrecognised failure', async () => {
    respond(new AccountApiError('boom', 500));
    renderProvider('khpc', true);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('unavailable'));
  });

  it('reports capabilities the organisation does not have as absent', async () => {
    respond({
      ...TEST_ME,
      organisation: { ...TEST_ME.organisation, capabilities: ['memberships'] },
    });
    renderProvider('khpc', true);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'));
    expect(screen.getByTestId('has-events')).toHaveTextContent('false');
  });

  it('takes the theme colour from the public record, which /me does not carry', async () => {
    respond(TEST_ME);
    renderProvider('khpc', true);

    await waitFor(() => expect(screen.getByTestId('primary')).toHaveTextContent('#1976d2'));
  });

  it('does not fail the organisation when only its branding cannot be loaded', async () => {
    // Branding is cosmetic — a member must still reach the app without it.
    mockExecute.mockImplementation((request: { url: string }) =>
      request.url.startsWith('/api/public/')
        ? Promise.reject(new AccountApiError('no branding', 500))
        : Promise.resolve(TEST_ME)
    );
    renderProvider('khpc', true);

    await waitFor(() => expect(screen.getByTestId('state')).toHaveTextContent('connected'));
    expect(screen.getByTestId('primary')).toHaveTextContent('none');
  });
});
