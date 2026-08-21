/**
 * Which language a club is read in.
 *
 * The resolution had two sources, both of which come from `/me` — and `me` is
 * null for a signed-out visitor. So a French club's **public** programme was
 * read in English by everyone who had not signed in, which is precisely the
 * audience those pages exist for.
 *
 * The club's public record carries its language and is fetched regardless of
 * session. That is not a fallback for tidiness; it is the only source an
 * anonymous visitor has.
 *
 * See docs/PUBLIC_EVENTS.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/*
 * `vi.hoisted`, because `vi.mock` is lifted to the top of the file and a plain
 * `const` above it is still in its temporal dead zone when the factory runs.
 * CLAUDE.md §3.4 names this exact trap.
 */
const { changeLocale } = vi.hoisted(() => ({
  changeLocale: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../i18n/config', async () => {
  const actual = await vi.importActual<typeof import('../../i18n/config')>('../../i18n/config');
  return { ...actual, changeLocale };
});

let contextValue: any;
vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return {
    ...actual,
    useAccountOrganisation: () => contextValue,
    AccountOrganisationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock('../../context/AuthContext', async () => {
  const actual = await vi.importActual<typeof import('../../context/AuthContext')>(
    '../../context/AuthContext'
  );
  return { ...actual, useAuthContext: () => ({ authenticated: false, loading: false }) };
});

import OrganisationRoute from '../OrganisationRoute';

const context = (over: Record<string, unknown> = {}) => ({
  orgCode: 'khpc',
  state: 'connected',
  me: null,
  publicDetail: null,
  primaryColor: null,
  publicLoading: false,
  capabilities: [],
  hasCapability: () => true,
  resolve: vi.fn(),
  ...over,
});

const renderRoute = () =>
  render(
    <MemoryRouter>
      <OrganisationRoute allowAnonymous requireConnection={false}>
        <div>content</div>
      </OrganisationRoute>
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  contextValue = context();
});

describe('an anonymous visitor', () => {
  it('reads a club in the club’s own language', async () => {
    /*
     * The defect: with no session there was nothing to read a language from,
     * so a French club's public pages rendered in English.
     */
    contextValue = context({ publicDetail: { displayName: 'Club', language: 'fr-FR' } });

    renderRoute();

    await waitFor(() => expect(changeLocale).toHaveBeenCalledWith('fr-FR'));
  });

  it('changes nothing when the club has not chosen one', async () => {
    // Null means "no preference", not "English" — the app default already
    // covers that, and forcing it would override a browser preference.
    contextValue = context({ publicDetail: { displayName: 'Club', language: null } });

    renderRoute();

    await waitFor(() => expect(changeLocale).not.toHaveBeenCalled());
  });
});

describe('a signed-in member', () => {
  it('is read in their own preferred language, above the club’s', async () => {
    contextValue = context({
      me: { user: { preferredLanguage: 'de-DE' }, organisation: { language: 'fr-FR' } },
      publicDetail: { displayName: 'Club', language: 'it-IT' },
    });

    renderRoute();

    await waitFor(() => expect(changeLocale).toHaveBeenCalledWith('de-DE'));
  });

  it('falls to the club’s language when they have expressed none', async () => {
    contextValue = context({
      me: { user: { preferredLanguage: null }, organisation: { language: 'fr-FR' } },
      publicDetail: { displayName: 'Club', language: 'it-IT' },
    });

    renderRoute();

    await waitFor(() => expect(changeLocale).toHaveBeenCalledWith('fr-FR'));
  });

  it('uses the public record only when the session carries nothing', async () => {
    // The order matters: the session is more specific to this reader than the
    // club's public record, which is the same for everyone.
    contextValue = context({
      me: { user: { preferredLanguage: null }, organisation: { language: null } },
      publicDetail: { displayName: 'Club', language: 'pt-PT' },
    });

    renderRoute();

    await waitFor(() => expect(changeLocale).toHaveBeenCalledWith('pt-PT'));
  });
});
