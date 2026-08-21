/**
 * The public event shapes, mirroring `backend/src/services/public-event.service`.
 *
 * Kept separate from `account.ts` because these are the only types in the app
 * describing something an anonymous visitor sees. Nothing here carries a person.
 */

export interface PublicActivity {
  id: string;
  name: string;
  description: string | null;
  /** Minor units. */
  fee: number;
  entriesLimit: number | null;
  placesRemaining: number | null;
  /** Listed and labelled, never presented as enterable. */
  membersOnly: boolean;
  membersOnlyScope: 'club' | 'organisation-type' | null;
}

export interface PublicEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  entriesOpenDate: string | null;
  entriesClosingDate: string | null;
  entriesLimit: number | null;
  placesRemaining: number | null;
  eventType: string | null;
  venue: { name: string; address: string | null; region: string | null } | null;
  location: { latitude: number; longitude: number } | null;
  organisation: { code: string; name: string; currency: string };
  activities: PublicActivity[];
  updatedAt: string;
}
