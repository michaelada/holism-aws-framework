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
    document.head.innerHTML = '<link rel="icon" type="image/png" href="/favicon.png" />';
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
    expect(iconHref()).toBe('/favicon.png');
  });

  it('leaves the platform icon alone when there is no logo', () => {
    renderHook(() => useOrganisationFavicon(null));

    expect(iconHref()).toBe('/favicon.png');
  });

  it('treats a blank logo as no logo', () => {
    renderHook(() => useOrganisationFavicon('   '));

    expect(iconHref()).toBe('/favicon.png');
  });

  it('restores the platform icon when leaving the organisation', async () => {
    const { unmount } = renderHook(() => useOrganisationFavicon('https://cdn.test/khpc-logo.png'));

    await waitFor(() => expect(iconHref()).toBe('https://cdn.test/khpc-logo.png'));
    unmount();

    // Leaving one club's mark on the directory would be worse than never
    // swapping it, because the tab would then be actively wrong.
    expect(iconHref()).toBe('/favicon.png');
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
