import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { AuthProvider } from './context/AuthContext';
import { AccountOrganisationProvider } from './context/AccountOrganisationContext';
import { useAuthContext } from './context/AuthContext';
import { buildTheme } from './theme';
import OrganisationRoute from './components/OrganisationRoute';
import StaleDataProvider from './offline/StaleDataContext';
import OrganisationDirectoryPage from './pages/OrganisationDirectoryPage';
import PublicEventsPage from './pages/PublicEventsPage';
import PlatformEventsPage from './pages/PlatformEventsPage';
import PublicEventPage from './pages/PublicEventPage';
import ConfirmEmailChangePage from './pages/ConfirmEmailChangePage';
import OrganisationSwitcherPage from './pages/OrganisationSwitcherPage';
import RegisterWithOrganisationPage from './pages/RegisterWithOrganisationPage';
import AwaitingApprovalPage from './pages/AwaitingApprovalPage';
import HomePage from './pages/HomePage';
import MyEntriesPage from './pages/MyEntriesPage';
import EntryDetailPage from './pages/EntryDetailPage';
import MyMembershipsPage from './pages/MyMembershipsPage';
import MyTicketsPage from './pages/MyTicketsPage';
import TicketPage from './pages/TicketPage';
import ProfilePage from './pages/ProfilePage';
import CapabilityGate from './components/CapabilityGate';
import BrowsePage from './pages/BrowsePage';
import EntryFormPage from './pages/EntryFormPage';
import RegisterInterestPage from './pages/RegisterInterestPage';
import RegistrationFormPage from './pages/RegistrationFormPage';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import BookPage from './pages/BookPage';
import BookCalendarPage from './pages/BookCalendarPage';
import ShopPage from './pages/ShopPage';
import ShopItemPage from './pages/ShopItemPage';
import MyOrdersPage from './pages/MyOrdersPage';
import MyPaymentsPage from './pages/MyPaymentsPage';
import CartPage from './pages/CartPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080',
  realm: import.meta.env.VITE_KEYCLOAK_REALM || 'aws-framework',
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'account-app',
};

/**
 * Routes that live outside any organisation.
 *
 * These use the default theme — there is no club to brand them with. Anything
 * under `/:orgCode` goes through `OrganisationRoute`, which resolves the
 * organisation and applies its branding and language before rendering.
 */
const UnbrandedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = React.useMemo(() => buildTheme(null), []);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

/**
 * `/switch` needs a session but no particular organisation, so it gets a
 * provider with a null code — enough for the switcher to know which entry is
 * current without resolving one.
 */
const SwitcherRoute: React.FC = () => {
  const { authenticated, loading } = useAuthContext();

  if (loading) return null;
  if (!authenticated) return <Navigate to="/" replace />;

  return (
    <AccountOrganisationProvider orgCode={null} authenticated={authenticated}>
      <UnbrandedRoute>
        <OrganisationSwitcherPage />
      </UnbrandedRoute>
    </AccountOrganisationProvider>
  );
};

export const App: React.FC = () => (
  <AuthProvider keycloakConfig={keycloakConfig}>
    {/* basename matches vite's `base` — the app is served under /account. */}
    <BrowserRouter basename="/account">
      {/*
        Inside the router because it clears on navigation — the claim "some of
        this is saved" is about the screen in front of the member, and carrying
        it to the next one would leave a fresh page wearing a stale label.
      */}
      <StaleDataProvider>
        <Routes>
          <Route
            path="/"
            element={
              <UnbrandedRoute>
                <OrganisationDirectoryPage />
              </UnbrandedRoute>
            }
          />

          <Route path="/switch" element={<SwitcherRoute />} />

          {/*
            P6 — the email-change link lands here.

            Unbranded and outside `/:orgCode` on purpose: an address belongs to
            the identity rather than to a club, and this is opened cold from a
            mail client with no session and no organisation to resolve. It is
            declared before the organisation routes so `confirm-email` is not
            read as an organisation code.
          */}
          <Route
            path="/confirm-email"
            element={
              <UnbrandedRoute>
                <ConfirmEmailChangePage />
              </UnbrandedRoute>
            }
          />

          {/*
          Registration and the pending screen sit inside OrganisationRoute so
          they are branded and share the resolved organisation, but they are
          declared before the catch-all so `/khpc/register` is not read as a
          page within the app.
        */}
          <Route
            path="/:orgCode/register"
            element={
              <OrganisationRoute requireConnection={false}>
                <RegisterWithOrganisationPage />
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/pending"
            element={
              <OrganisationRoute requireConnection={false}>
                <AwaitingApprovalPage />
              </OrganisationRoute>
            }
          />

          {/*
          "My activity" (C1, C2, C4). Each sits behind both OrganisationRoute —
          which requires an active membership — and a CapabilityGate, because
          hiding a menu item does not stop a member typing the URL.
        */}
          <Route
            path="/:orgCode/entries"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['event-management', 'calendar-bookings']}>
                  <MyEntriesPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/entries/:entryId"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['event-management']}>
                  <EntryDetailPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/memberships"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['memberships']}>
                  <MyMembershipsPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          C9/C10 — tickets. Gated on `event-ticketing` rather than
          `event-management`: a club can run events without issuing tickets, and
          a My Tickets page that is always empty is worse than no page.
        */}
          <Route
            path="/:orgCode/tickets"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['event-ticketing']}>
                  <MyTicketsPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/tickets/:ticketId"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['event-ticketing']}>
                  <TicketPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          P1 — profile. Not capability-gated: every member has an identity to
          maintain, whatever the club has enabled.
        */}
          <Route
            path="/:orgCode/profile"
            element={
              <OrganisationRoute>
                <ProfilePage />
              </OrganisationRoute>
            }
          />

          {/*
          Browse, basket and checkout. The basket and checkout are NOT
          capability-gated: a basket can hold items from any enabled area, and
          gating it on one capability would hide it from a club that sells only
          through another.
        */}
          {/*
          Two catalogues, two routes. Each is capability-gated on its own, so a
          club with only memberships never sees an events page at all — the
          previous single screen had to render a tab strip and then explain why
          one tab was missing.
        */}
          <Route
            path="/:orgCode/browse/events"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['event-management']}>
                  <BrowsePage section="events" />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/browse/memberships"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['memberships']}>
                  <BrowsePage section="memberships" />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          Entering is a page, not a dialog: club application forms can be long,
          and the terms a member has to agree to have to be readable without an
          overlay. Addressable by id so the page survives a reload.
        */}
          <Route
            path="/:orgCode/browse/events/:itemId/enter"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['event-management']}>
                  <EntryFormPage kind="event" />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/browse/memberships/:itemId/apply"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['memberships']}>
                  <EntryFormPage kind="membership" />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          Registrations. `/registrations` is My Activity, `/register-interest`
          is the catalogue — two menu entries, because "what have I registered"
          and "what can I register" are different questions.
        */}
          <Route
            path="/:orgCode/registrations"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['registrations']}>
                  <MyRegistrationsPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/register-interest"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['registrations']}>
                  <RegisterInterestPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/register-interest/:typeId"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['registrations']}>
                  <RegistrationFormPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          Booking. The calendar page holds a week of availability and the slot
          the member picks from it; both live on the same screen because
          choosing a time *is* the booking form.
        */}
          <Route
            path="/:orgCode/book"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['calendar-bookings']}>
                  <BookPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/book/:calendarId"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['calendar-bookings']}>
                  <BookCalendarPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          The shop. The item page is its own route rather than a dialog for the
          same reason entering is: options, a form and terms do not fit an
          overlay, and a member who reloads should still be looking at the shirt
          they were looking at.
        */}
          <Route
            path="/:orgCode/shop"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['merchandise']}>
                  <ShopPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/shop/:itemId"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['merchandise']}>
                  <ShopItemPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          C8. Declared before `/orders/:paymentId` so the bare path is not
          swallowed by the payment confirmation route.
        */}
          <Route
            path="/:orgCode/orders"
            element={
              <OrganisationRoute>
                <CapabilityGate anyOf={['merchandise']}>
                  <MyOrdersPage />
                </CapabilityGate>
              </OrganisationRoute>
            }
          />
          {/*
          F1/F2 — receipts. Not capability-gated: a payment can cover items from
          any area, and a member has a right to their own receipts whatever the
          club has since switched off.
        */}
          <Route
            path="/:orgCode/payments"
            element={
              <OrganisationRoute>
                <MyPaymentsPage />
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/cart"
            element={
              <OrganisationRoute>
                <CartPage />
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/checkout"
            element={
              <OrganisationRoute>
                <CheckoutPage />
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/orders/:paymentId"
            element={
              <OrganisationRoute>
                <OrderConfirmationPage />
              </OrganisationRoute>
            }
          />

          {/*
            Public event pages.
            
            `allowAnonymous` — a visitor arriving from a search result has no
            session and may never have heard of the club, so the gateway is
            skipped entirely. The club's branding still applies.
            
            Declared before `/:orgCode` so `whats-on` is matched as a page
            rather than being read as the start of a club's own route tree.
            
            See docs/PUBLIC_EVENTS.md.
          */}
          {/*
            The platform listing — every club's public events in one place.
            
            Declared before `/:orgCode` so `events` is matched as this page
            rather than as an organisation code. `events` is reserved in
            `RESERVED_URL_CODES` and in migration 1709000000033 so no club can
            take it and shadow this route.
          */}
          <Route
            path="/events"
            element={
              <UnbrandedRoute>
                <PlatformEventsPage />
              </UnbrandedRoute>
            }
          />

          <Route
            path="/:orgCode/whats-on"
            element={
              <OrganisationRoute allowAnonymous requireConnection={false}>
                <PublicEventsPage />
              </OrganisationRoute>
            }
          />
          <Route
            path="/:orgCode/whats-on/:slug"
            element={
              <OrganisationRoute allowAnonymous requireConnection={false}>
                <PublicEventPage />
              </OrganisationRoute>
            }
          />

          <Route
            path="/:orgCode"
            element={
              <OrganisationRoute>
                <HomePage />
              </OrganisationRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StaleDataProvider>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
