import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PoweredByFooter } from '../PoweredByFooter';

/**
 * The attribution at the foot of a signed-out page.
 *
 * The care here is about the link, which leaves the platform from a page where
 * somebody may be halfway through a registration form, and about the year,
 * which is the caller's job precisely so it cannot be baked into a translation
 * and go quietly wrong every 1st of January.
 *
 * See docs/PLATFORM_POSTS.md.
 */

const props = {
  poweredBy: 'Powered by ItsPlainSailing.com',
  copyright: '© 2026 Esker Software. All rights reserved',
};

describe('what it says', () => {
  it('shows the attribution and the copyright together', () => {
    render(<PoweredByFooter {...props} />);

    expect(screen.getByText(/Powered by ItsPlainSailing\.com/)).toBeInTheDocument();
    expect(screen.getByText(/© 2026 Esker Software\. All rights reserved/)).toBeInTheDocument();
  });

  it('takes both strings from the caller, so they can be translated', () => {
    // Nothing English is hard-coded in the component (CLAUDE.md §3.2).
    render(
      <PoweredByFooter
        poweredBy="Propulsé par ItsPlainSailing.com"
        copyright="© 2026 Esker Software. Tous droits réservés"
      />
    );

    expect(screen.getByText(/Propulsé par/)).toBeInTheDocument();
    expect(screen.getByText(/Tous droits réservés/)).toBeInTheDocument();
  });

  it('keeps the separator out of both strings', () => {
    /*
     * It is markup, not text, so a translator is never handed a dangling " - "
     * to puzzle over — and it is hidden from screen readers, which would
     * otherwise read a dash between two unrelated sentences.
     */
    const { container } = render(<PoweredByFooter {...props} />);

    const separator = container.querySelector('[aria-hidden="true"]');
    expect(separator).toBeInTheDocument();
    expect(separator?.textContent).not.toMatch(/Powered|Esker/);
  });
});

describe('the link', () => {
  it('opens in a new tab without handing over the opener', () => {
    // A visitor mid-registration should not lose the form to a footer click.
    render(<PoweredByFooter {...props} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('points at itsplainsailing.com by default', () => {
    render(<PoweredByFooter {...props} />);

    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://itsplainsailing.com');
  });

  it('can be pointed somewhere else', () => {
    render(<PoweredByFooter {...props} href="https://example.com" />);

    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com');
  });
});

describe('the mark', () => {
  it('is rendered when the app supplies one', () => {
    // The path is the app's to know: this package ships no asset.
    const { container } = render(<PoweredByFooter {...props} logoSrc="/account/logo.png" />);

    expect(container.querySelector('img')).toHaveAttribute('src', '/account/logo.png');
  });

  it('is left out entirely when there is none', () => {
    const { container } = render(<PoweredByFooter {...props} />);

    expect(container.querySelector('img')).toBeNull();
  });

  it('carries no alt text, because the words beside it say the same thing', () => {
    const { container } = render(<PoweredByFooter {...props} logoSrc="/account/logo.png" />);

    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });
});
