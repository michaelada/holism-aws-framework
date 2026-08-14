/**
 * The icons a club may attach to a bookable calendar.
 *
 * A **curated set, not the whole Material library.** Two reasons. A picker over
 * two thousand icons is a search box nobody knows what to type into, and every
 * icon a club can choose has to be bundled by both front ends — importing the
 * library wholesale to make a dozen reachable is a megabyte spent on nothing.
 *
 * Chosen to cover what clubs actually book: courts and pitches, water, indoor
 * rooms, equestrian facilities, and the general-purpose shapes for everything
 * else. Adding one is a line here plus its import in `CalendarIcon`.
 *
 * The stored value is the **key**, not a component, because it goes in a
 * `varchar` column and has to survive a version of the icon library changing
 * underneath it.
 */
export const CALENDAR_ICON_KEYS = [
  // Courts, pitches and tracks
  'tennis',
  'basketball',
  'football',
  'golf',
  'cricket',
  'athletics',
  // Water
  'pool',
  'sailing',
  // Equestrian and outdoor
  'equestrian',
  'hiking',
  'park',
  // Rooms and buildings
  'clubhouse',
  'meetingRoom',
  'restaurant',
  'gym',
  // Anything else
  'calendar',
  'group',
  'lesson',
  'event',
  'place',
] as const;

export type CalendarIconKey = (typeof CALENDAR_ICON_KEYS)[number];

/** Whether a stored value still names an icon this build knows about. */
export const isCalendarIconKey = (value: unknown): value is CalendarIconKey =>
  typeof value === 'string' && (CALENDAR_ICON_KEYS as readonly string[]).includes(value);

/**
 * English names for the picker.
 *
 * The org-admin app resolves these through i18n; this is the fallback and the
 * source of the keys, so a new icon is not silently unlabelled.
 */
export const CALENDAR_ICON_LABELS: Record<CalendarIconKey, string> = {
  tennis: 'Tennis',
  basketball: 'Basketball',
  football: 'Football',
  golf: 'Golf',
  cricket: 'Cricket',
  athletics: 'Athletics',
  pool: 'Swimming',
  sailing: 'Sailing',
  equestrian: 'Equestrian',
  hiking: 'Hiking',
  park: 'Grounds',
  clubhouse: 'Clubhouse',
  meetingRoom: 'Meeting room',
  restaurant: 'Dining',
  gym: 'Gym',
  calendar: 'Calendar',
  group: 'Group',
  lesson: 'Lesson',
  event: 'Event',
  place: 'Venue',
};
