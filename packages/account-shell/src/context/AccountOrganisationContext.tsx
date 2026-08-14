import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAccountApi, AccountApiError } from '../hooks/useAccountApi';
import { useOrganisationFavicon } from '../hooks/useOrganisationFavicon';
import { AccountMe, PublicOrganisationDetail } from '../types/account';

/**
 * What the shell knows about the organisation in the URL.
 *
 * `state` is the whole point of this context. Resolving an organisation is not
 * a success/failure pair — it has five distinguishable outcomes, and each one
 * routes somewhere different (A2, A6, A8, or the app itself). Reducing it to
 * `organisation | null` would lose the distinction between "not signed in",
 * "signed in but not a member" and "member awaiting approval", which are three
 * different screens.
 */
export type OrganisationState =
  | 'loading'
  | 'anonymous'
  | 'connected'
  | 'not-connected'
  | 'pending'
  | 'rejected'
  | 'inactive'
  | 'unavailable';

export interface AccountOrganisationContextValue {
  orgCode: string | null;
  state: OrganisationState;
  me: AccountMe | null;
  /** The club's public record — branding, and the gateway's call to action. */
  publicDetail: PublicOrganisationDetail | null;
  /** Primary colour for the shell's theme, or null to fall back to the default. */
  primaryColor: string | null;
  /**
   * True while the public record is in flight.
   *
   * Separate from `state`, which settles to `anonymous` immediately for a
   * signed-out visitor. Without this the gateway would decide the organisation
   * does not exist before its record has arrived, and flash "not found" at
   * every visitor arriving on a club's own link.
   */
  publicLoading: boolean;
  capabilities: string[];
  hasCapability: (capability: string) => boolean;
  /**
   * Re-resolves without a page reload — backs A8's "Check again".
   *
   * Returns the state it settled on rather than void, so a caller can react to
   * the outcome immediately. Reading `state` after awaiting would read the
   * previous render's value and race the re-render.
   */
  refresh: () => Promise<OrganisationState>;
}

const AccountOrganisationContext = createContext<AccountOrganisationContextValue | null>(null);

/** Maps the API's refusal codes onto the states above. */
/**
 * Is this actually the `/me` payload?
 *
 * Only the two branches the app dereferences are checked — `user` and
 * `organisation`. This is a sanity check against a response from something
 * other than the API, not a schema validator, and tightening it further would
 * start rejecting responses the backend is legitimately free to extend.
 */
function isAccountMe(value: unknown): value is AccountMe {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AccountMe>;
  return (
    typeof candidate.user === 'object' &&
    candidate.user !== null &&
    typeof candidate.organisation === 'object' &&
    candidate.organisation !== null
  );
}

function stateForCode(code: string | undefined): OrganisationState {
  switch (code) {
    case 'NOT_CONNECTED':
      return 'not-connected';
    case 'PENDING_APPROVAL':
      return 'pending';
    case 'REGISTRATION_REJECTED':
      return 'rejected';
    case 'ACCOUNT_INACTIVE':
      return 'inactive';
    case 'ORGANISATION_UNAVAILABLE':
      return 'unavailable';
    default:
      return 'unavailable';
  }
}

export const AccountOrganisationProvider: React.FC<{
  orgCode: string | null;
  authenticated: boolean;
  children: React.ReactNode;
}> = ({ orgCode, authenticated, children }) => {
  const { execute } = useAccountApi<AccountMe>();
  const { execute: executePublic } = useAccountApi<PublicOrganisationDetail>();
  const [state, setState] = useState<OrganisationState>('loading');
  const [me, setMe] = useState<AccountMe | null>(null);
  const [publicDetail, setPublicDetail] = useState<PublicOrganisationDetail | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);

  /**
   * The public record, fetched for every organisation regardless of session.
   *
   * `/me` deliberately returns only what the shell needs to draw a menu — it
   * carries no branding — so the club's logo and primary colour come from the
   * public endpoint instead. Fetching it here rather than in the gateway means
   * one request serves both the theme and the gateway screen, and a signed-in
   * member gets a branded shell without the backend having to grow a field
   * (CLAUDE.md §1.7).
   */
  useEffect(() => {
    if (!orgCode) {
      setPublicDetail(null);
      setPublicLoading(false);
      return;
    }
    let cancelled = false;
    setPublicLoading(true);
    executePublic({ url: `/api/public/organisations/${orgCode}`, anonymous: true })
      .then((detail) => {
        if (!cancelled) setPublicDetail(detail);
      })
      .catch(() => {
        // Branding is cosmetic; failing to load it must not block the app.
        if (!cancelled) setPublicDetail(null);
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgCode, executePublic]);

  /*
   * The tab icon follows the club, for the same reason the header logo does:
   * a member with three clubs open should not have to read three titles to
   * tell the tabs apart. Driven from here rather than from the shell because
   * this is where the branding lands, and the gateway and directory screens
   * render outside `AppShell`.
   */
  useOrganisationFavicon(publicDetail?.branding?.logoUrl);

  const resolve = useCallback(async (): Promise<OrganisationState> => {
    // A signed-out visitor is not an error — the gateway (A2) is a public
    // screen, so this resolves to `anonymous` without calling the API at all.
    if (!orgCode || !authenticated) {
      setState('anonymous');
      setMe(null);
      return 'anonymous';
    }

    setState('loading');
    try {
      const result = await execute({ url: `/api/account/${orgCode}/me` });

      /*
       * A 2xx is not proof the API answered. Anything else serving this origin
       * — a dev proxy pointed at the wrong process, a captive portal, an HTML
       * error page — returns 200 with a body that is not this payload, and
       * `execute` resolves happily. Trusting it puts a string where the app
       * expects an object, and every consumer of `me.organisation` throws:
       * a blank screen with a stack trace, which is the least useful failure
       * available and hides the actual cause.
       *
       * `unavailable` already has a screen. Use it.
       */
      if (!isAccountMe(result)) {
        // eslint-disable-next-line no-console
        console.error('Unexpected response from /me; treating the organisation as unavailable', result);
        setMe(null);
        setState('unavailable');
        return 'unavailable';
      }

      setMe(result);
      setState('connected');
      return 'connected';
    } catch (err) {
      const resolved =
        err instanceof AccountApiError ? stateForCode(err.code) : 'unavailable';
      setMe(null);
      setState(resolved);
      return resolved;
    }
  }, [orgCode, authenticated, execute]);

  useEffect(() => {
    void resolve();
  }, [resolve]);

  // Both links optional: `me` can be set with an organisation the API did not
  // send, and a missing capability list is "none" rather than a crash.
  const capabilities = me?.organisation?.capabilities ?? [];

  /**
   * Depends on the capability list's contents rather than the array identity —
   * a fresh array arrives from every fetch, and consumers put `hasCapability`
   * in effect dependencies.
   */
  const hasCapability = useCallback(
    (capability: string) => capabilities.includes(capability),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [capabilities.join(',')]
  );

  const value = useMemo<AccountOrganisationContextValue>(
    () => ({
      orgCode,
      state,
      me,
      publicDetail,
      primaryColor: publicDetail?.branding?.primaryColor ?? null,
      publicLoading,
      capabilities,
      hasCapability,
      refresh: resolve,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orgCode, state, me, publicDetail, publicLoading, capabilities.join(','), hasCapability, resolve]
  );

  return (
    <AccountOrganisationContext.Provider value={value}>
      {children}
    </AccountOrganisationContext.Provider>
  );
};

export const useAccountOrganisation = (): AccountOrganisationContextValue => {
  const context = useContext(AccountOrganisationContext);
  if (!context) {
    throw new Error(
      'useAccountOrganisation must be used within an AccountOrganisationProvider'
    );
  }
  return context;
};
