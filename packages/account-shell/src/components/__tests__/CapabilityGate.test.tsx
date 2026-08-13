import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import CapabilityGate from '../CapabilityGate';
import {
  makeOrganisationContext,
  renderWithProviders,
  TEST_ME,
} from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

const withCapabilities = (capabilities: string[]) =>
  makeOrganisationContext({
    capabilities,
    me: { ...TEST_ME, organisation: { ...TEST_ME.organisation, capabilities } },
  });

const render = (anyOf: string[]) =>
  renderWithProviders(
    <CapabilityGate anyOf={anyOf}>
      <div>Gated page</div>
    </CapabilityGate>
  );

describe('CapabilityGate', () => {
  beforeEach(() => {
    contextValue = withCapabilities(['memberships']);
  });

  it('renders the page when the club has the capability', () => {
    render(['memberships']);
    expect(screen.getByText('Gated page')).toBeInTheDocument();
  });

  /**
   * Hiding a menu item is presentation, not access control — a member can still
   * type the URL, and the page behind it would call an endpoint the middleware
   * refuses, producing an error where an explanation belongs.
   */
  it('refuses a page the club has not enabled', () => {
    render(['event-management']);
    expect(screen.queryByText('Gated page')).not.toBeInTheDocument();
  });

  it('needs only one of several capabilities, matching the menu rule', () => {
    render(['event-management', 'memberships']);
    expect(screen.getByText('Gated page')).toBeInTheDocument();
  });

  it('waits rather than refusing while capabilities are still loading', () => {
    // Bouncing a member off a page they are entitled to, purely because the
    // capability list had not arrived, is the failure this prevents.
    contextValue = makeOrganisationContext({ state: 'loading', capabilities: [] });
    render(['memberships']);

    expect(screen.queryByText('Gated page')).not.toBeInTheDocument();
  });

  it('refuses when the club has no capabilities at all', () => {
    contextValue = withCapabilities([]);
    render(['memberships']);
    expect(screen.queryByText('Gated page')).not.toBeInTheDocument();
  });
});
