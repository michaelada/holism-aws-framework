/**
 * `schema.org/Event` — what Google's events experience actually reads.
 *
 * Most of these assertions are about what is **left out**. Structured data is
 * a set of claims made to a search engine on the club's behalf, and the two
 * ways to get it wrong are advertising something a reader cannot buy and
 * publishing coordinates nobody supplied.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §3.
 */
import { describe, it, expect } from 'vitest';
import { eventStructuredData } from '../EventStructuredData';
import type { PublicEvent } from '../../types/publicEvents';

const ORIGIN = 'https://itsps.org';

const activity = (over: Partial<PublicEvent['activities'][0]> = {}) => ({
  id: 'act-1',
  name: 'Grade 1 — 80cm',
  description: null,
  fee: 2500,
  entriesLimit: 40,
  placesRemaining: 12,
  membersOnly: false,
  membersOnlyScope: null,
  ...over,
});

/**
 * The fixture's dates, relative to whenever the suite runs.
 *
 * `eventStructuredData` compares `endDate` to now — a finished event offers
 * nothing — so an event written out as a fixed date is an event that quietly
 * finishes one morning, taking every `offers` assertion here with it. The same
 * trap caught `PublicEventPage.test.tsx` on 2 September 2026.
 *
 * The deliberately-past overrides below stay literal: 2020 is still in the past
 * next year.
 */
const daysFromNow = (days: number): string =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

/** When entries opened. Named, because one assertion reads it back. */
const ENTRIES_OPENED = daysFromNow(-30);

const event = (over: Partial<PublicEvent> = {}): PublicEvent => ({
  id: 'ev-1',
  slug: 'spring-show-a1b2c3d4',
  name: 'Spring Show Jumping League',
  description: 'Four rounds over the spring.',
  startDate: daysFromNow(21),
  endDate: daysFromNow(21),
  entriesOpenDate: ENTRIES_OPENED,
  entriesClosingDate: daysFromNow(14),
  entriesLimit: 120,
  placesRemaining: 112,
  eventType: 'Show Jumping',
  venue: { name: 'Craddockstown', address: 'Naas, Co. Kildare', region: 'Co. Kildare' },
  location: null,
  organisation: { code: 'khpc', name: 'Kildare Hunt Pony Club', currency: 'EUR' },
  activities: [activity()],
  updatedAt: daysFromNow(-2),
  ...over,
});

describe('the document', () => {
  it('declares itself an Event that happens in a field', () => {
    /*
     * The attendance mode is stated rather than left to be inferred: Google
     * treats a missing one as ambiguous, and an offline event with no mode can
     * drop out of location-based results.
     */
    const data = eventStructuredData(event(), ORIGIN) as any;

    expect(data['@type']).toBe('Event');
    expect(data.eventAttendanceMode).toBe('https://schema.org/OfflineEventAttendanceMode');
  });

  it('points at the club, not at the platform', () => {
    const data = eventStructuredData(event(), ORIGIN) as any;

    expect(data.url).toBe(`${ORIGIN}/account/khpc/whats-on/spring-show-a1b2c3d4`);
    expect(data.organizer.name).toBe('Kildare Hunt Pony Club');
  });

  it('carries the venue as a Place with its region', () => {
    const data = eventStructuredData(event(), ORIGIN) as any;

    expect(data.location['@type']).toBe('Place');
    expect(data.location.address.addressRegion).toBe('Co. Kildare');
  });

  it('publishes coordinates only when the venue has them', () => {
    // A null island is worse than no geo — it would place a Kildare show in
    // the Atlantic on any map that trusts this.
    expect((eventStructuredData(event(), ORIGIN) as any).location.geo).toBeUndefined();

    const geo = eventStructuredData(
      event({ location: { latitude: 53.2, longitude: -6.6 } }),
      ORIGIN
    ) as any;
    expect(geo.location.geo).toEqual({
      '@type': 'GeoCoordinates',
      latitude: 53.2,
      longitude: -6.6,
    });
  });

  it('omits location entirely when no venue is set', () => {
    const data = eventStructuredData(event({ venue: null }), ORIGIN) as any;
    expect(data.location).toBeUndefined();
  });
});

describe('offers', () => {
  it('prices an activity in major units, with the club’s currency', () => {
    const [offer] = (eventStructuredData(event(), ORIGIN) as any).offers;

    expect(offer.price).toBe('25.00');
    expect(offer.priceCurrency).toBe('EUR');
  });

  it('links to the entry page, not to the public page', () => {
    /*
     * This is the ticket link in a rich result. It has to lead somewhere a
     * signed-out visitor can act — which is why the sign-in return path had to
     * be fixed alongside this.
     */
    const [offer] = (eventStructuredData(event(), ORIGIN) as any).offers;

    expect(offer.url).toBe(`${ORIGIN}/account/khpc/browse/events?event=ev-1`);
  });

  it('never advertises a members-only activity', () => {
    /*
     * The rule that matters most here. A members-only class is not purchasable
     * by the person reading the search result, and publishing it as an
     * available offer puts a price in front of them they cannot pay.
     *
     * It stays on the visible page, labelled. It does not become a claim.
     */
    const data = eventStructuredData(
      event({
        activities: [
          activity(),
          activity({ id: 'act-2', name: "Members' Class", membersOnly: true, membersOnlyScope: 'club' }),
        ],
      }),
      ORIGIN
    ) as any;

    expect(data.offers).toHaveLength(1);
    expect(data.offers[0].name).toBe('Grade 1 — 80cm');
  });

  it('offers nothing at all when every activity is members-only', () => {
    const data = eventStructuredData(
      event({ activities: [activity({ membersOnly: true, membersOnlyScope: 'club' })] }),
      ORIGIN
    ) as any;

    expect(data.offers).toEqual([]);
  });

  it('reports a full activity as sold out rather than available', () => {
    const data = eventStructuredData(
      event({ activities: [activity({ placesRemaining: 0 })] }),
      ORIGIN
    ) as any;

    expect(data.offers[0].availability).toBe('https://schema.org/SoldOut');
  });

  it('says when entries open, so an offer is not claimed as live early', () => {
    const [offer] = (eventStructuredData(event(), ORIGIN) as any).offers;
    expect(offer.validFrom).toBe(ENTRIES_OPENED);
  });

  it('offers nothing for an event that has already happened', () => {
    // Whatever its classes say. A finished event is a record, not a sale.
    const data = eventStructuredData(
      event({ startDate: '2020-01-01T00:00:00.000Z', endDate: '2020-01-01T00:00:00.000Z' }),
      ORIGIN
    ) as any;

    expect(data.offers).toEqual([]);
  });
});
