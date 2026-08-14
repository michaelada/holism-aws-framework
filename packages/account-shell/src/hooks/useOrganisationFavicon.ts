import { useEffect } from 'react';

/** What `index.html` ships with, and what we put back on the way out. */
const DEFAULT_ICON = '/favicon.png';

/** Only the tab icon. `apple-touch-icon` is baked into a homescreen shortcut at
 * install time, so rewriting it mid-session changes nothing a user can see. */
const ICON_SELECTOR = 'link[rel="icon"]';

/**
 * Fly the club's own logo in the browser tab.
 *
 * A member who keeps three clubs open in three tabs sees the same platform mark
 * on all of them, and has to read the titles to tell which is which. The logo
 * they already recognise does that work at a glance, and it is the one piece of
 * branding a tab can carry.
 *
 * Restores the platform icon when the logo goes away — leaving a club's mark on
 * the directory or on another club's page would be worse than never swapping
 * it, because the tab would then be actively wrong.
 *
 * The swap is best-effort by design. A logo is an arbitrary uploaded file: it
 * may be a format the browser will not take as an icon, and its signed URL may
 * expire mid-session. Either way the browser keeps whatever icon it last had
 * and nothing else on the page is affected, which is the right outcome for
 * decoration.
 */
export function useOrganisationFavicon(logoUrl: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const link = document.querySelector<HTMLLinkElement>(ICON_SELECTOR);
    if (!link) return;

    const previous = link.getAttribute('href') ?? DEFAULT_ICON;
    const wanted = logoUrl?.trim();

    if (!wanted) {
      // Nothing to fly. Put the platform icon back if this org's logo is still up.
      if (previous !== DEFAULT_ICON) link.setAttribute('href', DEFAULT_ICON);
      return;
    }

    /*
     * Loaded first, applied second.
     *
     * Pointing the tab straight at an unverified URL is what makes a broken
     * logo visible: browsers that fail to decode an icon fall back to a blank
     * page glyph rather than to the previous one, so a bad upload would cost
     * the club its icon entirely. Proving the image decodes first means a
     * failure is simply a swap that never happens.
     */
    const probe = new Image();
    let cancelled = false;

    probe.onload = () => {
      if (!cancelled) link.setAttribute('href', wanted);
    };
    probe.src = wanted;

    return () => {
      cancelled = true;
      link.setAttribute('href', DEFAULT_ICON);
    };
  }, [logoUrl]);
}

export default useOrganisationFavicon;
