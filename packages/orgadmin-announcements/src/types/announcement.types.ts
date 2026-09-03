/**
 * What the announcements API returns and accepts.
 *
 * The card's own shape lives in `packages/components` — this module renders the
 * member's card as its preview, so the two must agree by construction rather
 * than by two declarations that look alike today.
 */

export type ImagePlacement = 'background' | 'header' | 'footer';

export const IMAGE_PLACEMENTS: ImagePlacement[] = ['background', 'header', 'footer'];

export interface Announcement {
  id: string;
  organisationId: string;
  title: string;
  /** HTML from the editor. */
  description: string;
  startsAt: string;
  endsAt: string;
  /** A signed URL, valid for an hour, or null. */
  imageUrl: string | null;
  imagePlacement: ImagePlacement | null;
  /** Where the notice points, or null. Both halves or neither. */
  link: AnnouncementLink | null;
  /** Whether the window contains now, decided by the server's clock. */
  showing: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementLink {
  label: string;
  url: string;
}

export interface AnnouncementInput {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  imagePlacement: ImagePlacement | null;
  linkLabel: string | null;
  linkUrl: string | null;
}

/**
 * Where an announcement is in its life, from its window alone.
 *
 * There is no draft flag — the dates are the only control — so this is derived
 * rather than stored, and the list, the badge and the editor all read it from
 * the same place.
 */
export type AnnouncementState = 'showing' | 'scheduled' | 'finished';

export const announcementState = (
  announcement: Pick<Announcement, 'startsAt' | 'endsAt'>,
  now: Date = new Date()
): AnnouncementState => {
  if (new Date(announcement.endsAt) <= now) return 'finished';
  if (new Date(announcement.startsAt) > now) return 'scheduled';
  return 'showing';
};
