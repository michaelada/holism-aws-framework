import { useEffect } from 'react';
import type { PublicEvent } from '../types/publicEvents';

/**
 * `schema.org/Event` for a public event.
 *
 * This is the highest-return piece of the search work, and it is worth being
 * clear why: Google has a **dedicated events experience** — the Events pane, and
 * event rich results carrying date, venue and a ticket link — and it is fed from
 * exactly this. For a product whose public surface is entirely events, structured
 * data is not a finishing touch on SEO, it is most of it.
 *
 * Rendered into `<head>` rather than the body, and removed on unmount, so a
 * single-page navigation never leaves the previous event's data describing the
 * current page.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §3.
 */

/** Minor units to the decimal string `Offer.price` expects. */
const price = (minor: number): string => (minor / 100).toFixed(2);

export const eventStructuredData = (
  event: PublicEvent,
  origin: string
): Record<string, unknown> => {
  const url = `${origin}/account/${event.organisation.code}/whats-on/${event.slug}`;
  const finished = new Date(event.endDate) < new Date();

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.name,
    description: event.description,
    startDate: event.startDate,
    endDate: event.endDate,
    /*
     * Horses in fields. Declared rather than left to be inferred, because
     * Google treats a missing attendance mode as ambiguous and an offline event
     * with no mode can be filtered out of location-based results.
     */
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    url,
    ...(event.venue
      ? {
          location: {
            '@type': 'Place',
            name: event.venue.name,
            ...(event.venue.address
              ? {
                  address: {
                    '@type': 'PostalAddress',
                    streetAddress: event.venue.address,
                    ...(event.venue.region ? { addressRegion: event.venue.region } : {}),
                  },
                }
              : {}),
            // Only when the venue has actually been geocoded. A null island is
            // worse than no coordinates.
            ...(event.location
              ? {
                  geo: {
                    '@type': 'GeoCoordinates',
                    latitude: event.location.latitude,
                    longitude: event.location.longitude,
                  },
                }
              : {}),
          },
        }
      : {}),
    organizer: {
      '@type': 'Organization',
      name: event.organisation.name,
      url: `${origin}/account/${event.organisation.code}/whats-on`,
    },
    /*
     * One offer per activity — but **only the ones a reader can actually
     * enter**.
     *
     * A members-only class is not purchasable by the person reading the search
     * result, and publishing it as an available offer would put a price in front
     * of them that they cannot pay. It stays on the visible page, where it is
     * labelled, and out of the structured data.
     *
     * A finished event offers nothing, whatever its classes say.
     */
    offers: finished
      ? []
      : event.activities
          .filter((activity) => !activity.membersOnly)
          .map((activity) => ({
            '@type': 'Offer',
            name: activity.name,
            price: price(activity.fee),
            priceCurrency: event.organisation.currency,
            // The entry link. It has to work for a signed-out visitor — a rich
            // result whose ticket link dead-ends is worse than no rich result.
            url: `${origin}/account/${event.organisation.code}/browse/events?event=${event.id}`,
            availability:
              activity.placesRemaining === 0
                ? 'https://schema.org/SoldOut'
                : 'https://schema.org/InStock',
            ...(event.entriesOpenDate ? { validFrom: event.entriesOpenDate } : {}),
          })),
  };
};

/**
 * Mounts the document's structured data for as long as the page is shown.
 *
 * A component rather than a call so that React's own lifecycle removes it: the
 * account app is a single page, and a `<script>` left behind after navigation
 * would describe an event the reader is no longer looking at.
 */
const EventStructuredData: React.FC<{ event: PublicEvent | null }> = ({ event }) => {
  useEffect(() => {
    if (!event) return undefined;

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.dataset.eventStructuredData = 'true';
    script.textContent = JSON.stringify(
      eventStructuredData(event, window.location.origin)
    );
    document.head.appendChild(script);

    return () => {
      script.remove();
    };
  }, [event]);

  return null;
};

export default EventStructuredData;
