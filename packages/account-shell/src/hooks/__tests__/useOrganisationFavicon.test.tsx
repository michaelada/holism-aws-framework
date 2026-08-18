import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOrganisationFavicon } from '../useOrganisationFavicon';

/**
 * jsdom never fetches images, so `onload` would never fire on its own. A stub
 * that resolves everything except a known-bad URL lets the "prove it decodes
 * first" behaviour be tested at all.
 */
class StubImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    queueMicrotask(() => {
      if (value.includes('broken')) this.onerror?.();
      else this.onload?.();
    });
  }
}

const iconHref = () =>
  document.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute('href');

describe('useOrganisationFavicon', () => {
  beforeEach(() => {
    // What the built `index.html` actually ships: Vite rewrites the absolute
    // path against `base`, so the platform icon lives under `/account/`.
    document.head.innerHTML =
      '<link rel="icon" type="image/png" href="/account/favicon.png" />';
    vi.stubGlobal('Image', StubImage);
  });

  it('flies the club logo once it is known to decode', async () => {
    renderHook(() => useOrganisationFavicon('https://cdn.test/khpc-logo.png'));

    await waitFor(() => expect(iconHref()).toBe('https://cdn.test/khpc-logo.png'));
  });

  it('keeps the platform icon when the logo will not load', async () => {
    // A broken upload must not cost the club its icon entirely.
    renderHook(() => useOrganisationFavicon('https://cdn.test/broken-logo.png'));

    await new Promise((resolve) => queueMicrotask(() => resolve(null)));
    expect(iconHref()).toBe('/account/favicon.png');
  });

  it('leaves the platform icon alone when there is no logo', () => {
    renderHook(() => useOrganisationFavicon(null));

    expect(iconHref()).toBe('/account/favicon.png');
  });

  it('treats a blank logo as no logo', () => {
    renderHook(() => useOrganisationFavicon('   '));

    expect(iconHref()).toBe('/account/favicon.png');
  });

  it('restores the platform icon when leaving the organisation', async () => {
    const { unmount } = renderHook(() => useOrganisationFavicon('https://cdn.test/khpc-logo.png'));

    await waitFor(() => expect(iconHref()).toBe('https://cdn.test/khpc-logo.png'));
    unmount();

    // Leaving one club's mark on the directory would be worse than never
    // swapping it, because the tab would then be actively wrong.
    expect(iconHref()).toBe('/account/favicon.png');
  });

  /*
   * This application is served from `/account/`, and Vite rewrites the path in
   * `index.html` to match — so the icon the page starts with is
   * `/account/favicon.png`. Restoring a literal `/favicon.png` puts back
   * something that does not exist, which is a 404 and a blank tab icon rather
   * than the platform mark.
   *
   * The assertions above cannot catch that: `BASE_URL` is `/` under Vitest, so
   * the correct and the incorrect implementation agree there. Stubbing it means
   * re-importing the hook, because the default is computed as the module loads.
   */
  // Both spellings of the base, because `BASE_URL` is whatever `vite.config`
  // was given, verbatim — and written without the trailing slash it silently
  // produces `/accountfavicon.png`.
  it.each([
    ['with a trailing slash', '/account/'],
    ['without one', '/account'],
  ])('restores the icon at the base path the app is served from (%s)', async (_name, base) => {
    vi.resetModules();
    vi.stubEnv('BASE_URL', base);
    document.head.innerHTML =
      '<link rel="icon" type="image/png" href="/account/favicon.png" />';

    const { useOrganisationFavicon: based } = await import('../useOrganisationFavicon');
    const { unmount } = renderHook(() => based('https://cdn.test/khpc-logo.png'));

    await waitFor(() => expect(iconHref()).toBe('https://cdn.test/khpc-logo.png'));
    unmount();

    expect(iconHref()).toBe('/account/favicon.png');

    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('swaps to the new logo when the member moves between clubs', async () => {
    const { rerender } = renderHook(({ logo }) => useOrganisationFavicon(logo), {
      initialProps: { logo: 'https://cdn.test/khpc-logo.png' },
    });

    await waitFor(() => expect(iconHref()).toBe('https://cdn.test/khpc-logo.png'));

    rerender({ logo: 'https://cdn.test/lhpc-logo.png' });

    await waitFor(() => expect(iconHref()).toBe('https://cdn.test/lhpc-logo.png'));
  });

  it('does nothing when the page has no icon link to update', () => {
    document.head.innerHTML = '';

    expect(() =>
      renderHook(() => useOrganisationFavicon('https://cdn.test/khpc-logo.png'))
    ).not.toThrow();
  });
});
