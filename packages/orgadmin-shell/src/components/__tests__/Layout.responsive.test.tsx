/**
 * The page must never scroll sideways.
 *
 * `main` is a flex child, and a flex child's default `min-width: auto` refuses
 * to shrink below its content. A 997px members table therefore pushed the whole
 * document to 1093px on a 390px phone: "Add Member" sat 464px beyond the right
 * edge, and nothing on screen suggested the page had scrolled at all. Settings
 * reached 877px and payments 693px the same way.
 *
 * DESIGN.md's *Reachable Not Optimised Rule* is the bar this holds to — an
 * administrator on a phone may be slower, but must never be blocked. Wide
 * content scrolls inside its own container; the page does not.
 *
 * jsdom computes no layout, so this asserts the property that produces the
 * behaviour rather than measured pixels. The pixels were verified in a browser:
 * 1093px → 390px at a 390px viewport.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Layout } from '../Layout';
import { OrganisationProvider } from '@aws-web-framework/orgadmin-core';
import { OnboardingProvider } from '../../context/OnboardingProvider';

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

const renderLayout = () => {
  window.history.pushState({}, '', '/events');
  return render(
    <BrowserRouter>
      <OrganisationProvider organisation={organisation}>
        <OnboardingProvider>
          <Layout>
            <div style={{ width: 4000 }}>A table far wider than any phone</div>
          </Layout>
        </OnboardingProvider>
      </OrganisationProvider>
    </BrowserRouter>
  );
};

describe('Layout stays within the viewport', () => {
  it('lets the content region shrink below its content', () => {
    /*
     * Queried by tag, not by role: `OnboardingProvider` mounts the welcome
     * dialog, and an open MUI modal `aria-hidden`s the rest of the document, so
     * `getByRole('main')` finds nothing here. That is a fact about the harness,
     * not about the layout.
     */
    const { container } = renderLayout();
    const main = container.querySelector('main')!;

    /*
     * The whole fix. Without `min-width: 0` the flex child grows to its widest
     * child and takes the document with it — which is how a 997px table made a
     * 390px phone scroll to 1093px.
     */
    // Read the computed value: `min-width: 0` is emitted unitless, and
    // `toHaveStyle({ minWidth: '0px' })` does not normalise the two.
    expect(getComputedStyle(main).minWidth).toMatch(/^0(px)?$/);
  });

  it('keeps the main region a flex child that can grow', () => {
    // `flexGrow: 1` with `minWidth: 0` is the pair that matters: fill the space
    // available, but never demand more than there is.
    const { container } = renderLayout();
    expect(container.querySelector('main')).toHaveStyle({ flexGrow: '1' });
  });
});
