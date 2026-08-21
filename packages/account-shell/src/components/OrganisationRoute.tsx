import React, { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress } from '@mui/material';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  AccountOrganisationProvider,
  useAccountOrganisation,
} from '../context/AccountOrganisationContext';
import { useAuthContext } from '../context/AuthContext';
import { buildTheme } from '../theme';
import { changeLocale, localeForLanguage } from '../i18n/config';
import AppShell from './AppShell';
import OrganisationGatewayPage from '../pages/OrganisationGatewayPage';
import NotConnectedPage from '../pages/NotConnectedPage';
import AwaitingApprovalPage from '../pages/AwaitingApprovalPage';

/**
 * Everything under `/:orgCode`.
 *
 * Resolving an organisation has several outcomes and each one is a different
 * screen, so this component is the single place that maps state to screen.
 * Putting the decision here rather than in each page is what stops a page from
 * rendering against a half-resolved organisation.
 *
 * `children` is the app itself, and it is only ever rendered in the `connected`
 * state — so any page inside can rely on `me` being present.
 */
export const OrganisationRoute: React.FC<{
  children: React.ReactNode;
  /**
   * Whether `children` may only render once the member is connected.
   *
   * True for the app itself. **False for the screens that exist precisely
   * because the member is not connected** — the registration page (A4) and the
   * awaiting-approval page (A8). Without this they would be replaced by the
   * not-connected screen that links to them, and "Request to join" would loop
   * straight back to itself.
   */
  requireConnection?: boolean;
  /**
   * Render for a signed-out visitor too.
   *
   * Distinct from `requireConnection`, and the difference is the whole point:
   * that one lets a *signed-in* person through who is not a member of this
   * club, and still sends an anonymous visitor to the gateway to sign in. A
   * public page has nobody to sign in — the visitor may never have heard of the
   * club — so it needs the gateway skipped entirely.
   *
   * The organisation is still resolved and its branding still applied; only the
   * identity gate is lifted.
   */
  allowAnonymous?: boolean;
}> = ({ children, requireConnection = true, allowAnonymous = false }) => {
  const { orgCode } = useParams<{ orgCode: string }>();
  const { authenticated, loading: authLoading } = useAuthContext();

  // Nothing may route on authentication until the silent SSO check settles;
  // otherwise a signed-in member is briefly treated as anonymous and bounced to
  // the public gateway before their session resolves.
  if (authLoading) {
    return <FullPageSpinner />;
  }

  return (
    <AccountOrganisationProvider orgCode={orgCode ?? null} authenticated={authenticated}>
      <OrganisationRouteContent
        requireConnection={requireConnection}
        allowAnonymous={allowAnonymous}
      >
        {children}
      </OrganisationRouteContent>
    </AccountOrganisationProvider>
  );
};

const OrganisationRouteContent: React.FC<{
  children: React.ReactNode;
  requireConnection: boolean;
  allowAnonymous: boolean;
}> = ({ children, requireConnection, allowAnonymous }) => {
  const { state, me, primaryColor, publicDetail } = useAccountOrganisation();

  /**
   * Theme and locale both follow the organisation, so both are applied here
   * rather than at the application root — neither value is known until the
   * organisation resolves. Memoised on the colour so switching clubs re-themes
   * without rebuilding the theme on every render.
   */
  const theme = React.useMemo(() => buildTheme(primaryColor), [primaryColor]);

  /*
   * The member's own language wins over the club's (P1). A club sets the
   * language its members generally read; a member who reads another one has
   * said so explicitly, and that is the more specific instruction.
   *
   * Null preference means "follow the organisation", which is the default and
   * what nearly every member does.
   */
  /**
   * Which language this club is read in.
   *
   * Three sources, in order of how specific they are to the reader:
   *
   *   1. the member's own preference
   *   2. the organisation's language, from their session
   *   3. **the organisation's language from its public record**
   *
   * The third is not a fallback for completeness — it is the only one that
   * exists for an anonymous visitor, and the public pages have nothing else.
   * Without it a French club's public programme was read in English by everyone
   * who had not signed in, which is precisely the audience those pages are for.
   */
  const language =
    me?.user.preferredLanguage || me?.organisation.language || publicDetail?.language;

  useEffect(() => {
    if (language) {
      void changeLocale(localeForLanguage(language));
    }
  }, [language]);

  let content: React.ReactNode;

  /**
   * A standalone screen renders itself for every settled state. It still waits
   * for `loading`, so it never draws against a half-resolved organisation, and
   * an anonymous visitor is still sent to the gateway to sign in first —
   * registering with a club requires an identity to connect.
   */
  /*
   * A public page renders for anyone the moment the organisation resolves —
   * including a visitor with no session, which is the case it exists for. An
   * unknown club still falls through to the gateway's not-found variant below.
   */
  if (allowAnonymous && state !== 'loading' && state !== 'unavailable') {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    );
  }

  if (!requireConnection && state !== 'loading' && state !== 'anonymous') {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    );
  }

  switch (state) {
    case 'loading':
      content = <FullPageSpinner />;
      break;
    case 'anonymous':
      // A2 — the public gateway. Reached with no session at all.
      content = <OrganisationGatewayPage />;
      break;
    case 'not-connected':
      content = <NotConnectedPage />;
      break;
    case 'pending':
    case 'rejected':
    case 'inactive':
      content = <AwaitingApprovalPage />;
      break;
    case 'unavailable':
      // An unknown or unavailable code reuses the gateway, which renders its own
      // not-found variant offering the directory.
      content = <OrganisationGatewayPage />;
      break;
    case 'connected':
      content = <AppShell>{children}</AppShell>;
      break;
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {content}
    </ThemeProvider>
  );
};

const FullPageSpinner: React.FC = () => {
  const { t } = useTranslation();
  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
      <CircularProgress aria-label={t('common.loading')} />
    </Box>
  );
};

export default OrganisationRoute;
