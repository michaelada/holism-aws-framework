import { useEffect } from 'react';

export interface PageMetadata {
  title: string;
  description: string;
  /** The one address this content should be indexed under. */
  canonical?: string;
  /** Kept out of search results — filtered views, and anything transient. */
  noindex?: boolean;
}

/**
 * The document's title, description, canonical and social preview.
 *
 * Every route in this application currently reports the same `<title>` —
 * "ItsPlainSailing" — and the same one-line description, because the shell's
 * `index.html` is static and nothing has ever set them. For pages behind a
 * login that costs nothing. For a public event page it costs the two things
 * that decide whether the page is any use:
 *
 *  - the search result's headline and snippet
 *  - the card that appears when a club pastes the link into Facebook or
 *    WhatsApp, which today is a grey box with no title, image or description
 *
 * Written directly to the DOM rather than through a helmet library: this is
 * about a dozen lines, the app has no other need for one, and a dependency that
 * manages `<head>` also wants to own it.
 *
 * Tags are removed on unmount so a single-page navigation cannot leave one
 * page's description attached to the next.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §2.
 */
const usePageMetadata = (metadata: PageMetadata | null): void => {
  useEffect(() => {
    if (!metadata) return undefined;

    const previousTitle = document.title;
    document.title = metadata.title;

    /** Tags this page created, removed wholesale on the way out. */
    const created: HTMLElement[] = [];
    /**
     * Tags that already existed, and what they said before.
     *
     * `description` lives in `index.html` and belongs to every other route, so
     * it is restored rather than deleted — removing it would leave the rest of
     * the application with no description at all after one visit here.
     */
    const restore: Array<{ element: HTMLMetaElement; content: string }> = [];

    const meta = (attribute: 'name' | 'property', key: string, content: string) => {
      const existing = document.head.querySelector<HTMLMetaElement>(
        `meta[${attribute}="${key}"]`
      );
      if (existing) {
        restore.push({ element: existing, content: existing.content });
        existing.content = content;
        return;
      }
      const element = document.createElement('meta');
      element.setAttribute(attribute, key);
      element.content = content;
      document.head.appendChild(element);
      created.push(element);
    };

    meta('name', 'description', metadata.description);

    /*
     * Open Graph and Twitter, which is what produces a link preview. `og:type`
     * is deliberately `article` rather than `website`: a single event is a
     * document, and scrapers treat the two differently when choosing a layout.
     */
    meta('property', 'og:title', metadata.title);
    meta('property', 'og:description', metadata.description);
    meta('property', 'og:type', 'article');
    if (metadata.canonical) meta('property', 'og:url', metadata.canonical);
    meta('name', 'twitter:card', 'summary_large_image');
    meta('name', 'twitter:title', metadata.title);
    meta('name', 'twitter:description', metadata.description);

    let canonicalLink: HTMLLinkElement | null = null;
    if (metadata.canonical) {
      canonicalLink = document.createElement('link');
      canonicalLink.rel = 'canonical';
      canonicalLink.href = metadata.canonical;
      document.head.appendChild(canonicalLink);
    }

    let robots: HTMLMetaElement | null = null;
    if (metadata.noindex) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      // `follow` matters as much as `noindex`: the links out of a filtered view
      // still lead to individual events that are worth crawling.
      robots.content = 'noindex,follow';
      document.head.appendChild(robots);
    }

    return () => {
      document.title = previousTitle;
      for (const element of created) element.remove();
      for (const { element, content } of restore) element.content = content;
      canonicalLink?.remove();
      robots?.remove();
    };
  }, [
    metadata?.title,
    metadata?.description,
    metadata?.canonical,
    metadata?.noindex,
  ]);
};

export default usePageMetadata;
