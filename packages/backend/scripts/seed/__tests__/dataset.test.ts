import { EVENTS, SeedEvent, assertEventDates } from '../dataset';

/**
 * The seed's events, checked against the rule `eventService.createEvent`
 * applies to everything that comes in through the API.
 *
 * The seed writes with raw SQL, so nothing else stops the fixture drifting
 * back to an event with no entry window — which reads as *permanently open*
 * rather than as missing data. See docs/EVENT_ENTRY_DATE_INVENTION_FIX.md.
 */
describe('seed events', () => {
  const event = (over: Partial<SeedEvent> = {}): SeedEvent =>
    ({
      key: 'test',
      org: 'kildare',
      name: 'Test Event',
      description: '',
      eventType: 'Rally',
      venue: 'Craddockstown Equestrian',
      startDays: 10,
      endDays: 10,
      openDays: -5,
      closeDays: 8,
      status: 'published',
      activities: [],
      ...over,
    }) as SeedEvent;

  it('gives every event all four dates', () => {
    for (const e of EVENTS) {
      expect(typeof e.startDays).toBe('number');
      expect(typeof e.endDays).toBe('number');
      expect(typeof e.openDays).toBe('number');
      expect(typeof e.closeDays).toBe('number');
    }
  });

  it('never ends an event before it starts, or closes entries before they open', () => {
    for (const e of EVENTS) {
      expect(() => assertEventDates(e)).not.toThrow();
    }
  });

  it('names the event when it ends before it starts', () => {
    expect(() => assertEventDates(event({ startDays: 10, endDays: 9 }))).toThrow(
      /"Test Event" ends before it starts/
    );
  });

  it('rejects an entry window that closes before it opens', () => {
    expect(() => assertEventDates(event({ openDays: 5, closeDays: -1 }))).toThrow(
      /closes to entries before it opens/
    );
  });

  it('rejects an entry window with no duration at all', () => {
    expect(() => assertEventDates(event({ openDays: 3, closeDays: 3 }))).toThrow(
      /closes to entries before it opens/
    );
  });

  it('accepts a window that opens in the past and closes in the future', () => {
    expect(() => assertEventDates(event({ openDays: -60, closeDays: 42 }))).not.toThrow();
  });
});
