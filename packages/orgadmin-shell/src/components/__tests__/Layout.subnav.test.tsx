/**
 * A sub-item stays selected when you drill into it.
 *
 * Adding a child route under a rail sub-item — `/payments/lodgements/:id` under
 * `/payments/lodgements` — broke the two places that answer "where am I?". Both
 * compared the pathname to the sub-item path with `===`, so opening one
 * lodgement left the rail with nothing selected and the breadcrumb stopping at
 * "Payments". The reader lost their place in the navigation by following a link
 * inside it.
 *
 * The fix is a longest-match, and the length part is not incidental:
 * `/payments` is a prefix of `/payments/lodgements`, so a plain `startsWith`
 * lights up "All payments" on every page in the module — which is a different
 * wrong answer, not a fix.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from '../Layout';
import { OrganisationProvider } from '@itsplainsailing/orgadmin-core';
import { OnboardingProvider } from '../../context/OnboardingProvider';
import type { ModuleRegistration } from '../../types/module.types';

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en-GB', changeLanguage: vi.fn() },
  }),
}));

const organisation = {
  id: 'org-1',
  organizationTypeId: 'type-1',
  keycloakGroupId: 'group-1',
  name: 'test-org',
  displayName: 'Test Organisation',
  status: 'active' as const,
  enabledCapabilities: [],
  settings: {},
  createdAt: new Date(),
  updatedAt: new Date(),
};

const payments: ModuleRegistration = {
  id: 'payments',
  name: 'modules.payments.name',
  title: 'modules.payments.title',
  description: 'modules.payments.description',
  capability: undefined,
  order: 4,
  routes: [
    { path: 'payments', component: () => null },
    { path: 'payments/lodgements', component: () => null },
    { path: 'payments/lodgements/:id', component: () => null },
  ],
  menuItem: { label: 'modules.payments.name', path: '/payments' },
  subMenuItems: [
    { label: 'payments.allMenu', path: '/payments' },
    { label: 'payments.lodgements.menu', path: '/payments/lodgements' },
  ],
} as ModuleRegistration;

const renderAt = (path: string) => {
  window.history.pushState({}, '', path);
  return render(
    <BrowserRouter>
      <OrganisationProvider organisation={organisation}>
        <OnboardingProvider>
          <Layout modules={[payments]}>
            <div>content</div>
          </Layout>
        </OnboardingProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};

/**
 * The rail's selected item, read from the DOM rather than by role.
 *
 * `OnboardingProvider` mounts the welcome dialog, and an open MUI modal
 * `aria-hidden`s the rest of the document — so `getAllByRole('button')` finds
 * nothing in the rail. That is a fact about this harness, not about the layout;
 * `Layout.responsive.test.tsx` works around the same thing.
 *
 * Selection is read from `Mui-selected`, which is what actually drives the
 * highlight, rather than from a colour that a theme change could move.
 */
const selectedSubItems = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll('nav .Mui-selected')).map(
    (element) => element.textContent ?? ''
  );

const selectedSubItem = (container: HTMLElement): string =>
  selectedSubItems(container).join(' | ');

describe('rail sub-item selection', () => {
  it('selects the sub-item you are on', () => {
    const { container } = renderAt('/payments/lodgements');
    expect(selectedSubItem(container)).toContain('payments.lodgements.menu');
  });

  it('keeps it selected on a child route', () => {
    // The defect: opening one lodgement deselected the rail entirely.
    const { container } = renderAt('/payments/lodgements/po_2');
    expect(selectedSubItem(container)).toContain('payments.lodgements.menu');
  });

  it('does not let the shorter path claim the longer one', () => {
    /*
     * `/payments` is a prefix of `/payments/lodgements`. Longest-match is what
     * keeps "All payments" from lighting up on every page in the module.
     */
    const { container } = renderAt('/payments/lodgements/po_2');
    expect(selectedSubItem(container)).not.toContain('payments.allMenu');
  });

  it('selects the index sub-item on a payment detail route', () => {
    // `/payments/pay-1` belongs to "All payments" — which previously matched
    // nothing at all, for the same reason.
    const { container } = renderAt('/payments/pay-1');
    expect(selectedSubItem(container)).toContain('payments.allMenu');
  });

  it('names the sub-item in the breadcrumb on a child route', () => {
    // The breadcrumb and the rail must never disagree about where you are.
    renderAt('/payments/lodgements/po_2');
    expect(screen.getAllByText('payments.lodgements.menu').length).toBeGreaterThan(1);
  });
});
