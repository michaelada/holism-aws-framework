import { db } from '../database/pool';
import { logger } from '../config/logger';
import { ValidationError, NotFoundError } from '../middleware/errors';
import { fileUploadService } from './file-upload.service';

/**
 * A club's own announcements, and when they are shown.
 *
 * Written by an organisation's administrator, read by that organisation's
 * members on their home page. The audience is what separates these from
 * `platform_posts`: those are the product's notices on a login page nobody has
 * signed in to, these are one club talking to its own members.
 *
 * Two things carry most of the weight here.
 *
 * **The window is the only control.** There is no draft flag; `starts_at` and
 * `ends_at` decide whether a notice is showing, and the account read applies
 * them **in SQL against the database's clock**. A member whose device clock is
 * wrong — or whose timezone the browser reports oddly — sees the same notices
 * as everybody else, which is the whole point of a club announcement.
 *
 * **The image is a key, and leaves here as a signed URL.** Storing a URL would
 * tie every row to a bucket name; serving one from an unauthenticated route, as
 * the platform's posts do, would hand a club's notices to anyone holding an id.
 * A club's members have a session, so a URL that expires costs them nothing.
 */

export type ImagePlacement = 'background' | 'header' | 'footer';

export const IMAGE_PLACEMENTS: ImagePlacement[] = ['background', 'header', 'footer'];

/** Where an announcement points, if it points anywhere. */
export interface AnnouncementLink {
  label: string;
  url: string;
}

export interface Announcement {
  id: string;
  organisationId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  /**
   * A signed URL, or null. Absent rather than empty when there is no image, so
   * a card never has to tell "no picture" from "a picture that failed".
   */
  imageUrl: string | null;
  imagePlacement: ImagePlacement | null;
  /**
   * The one place this notice points, or null.
   *
   * Both halves or neither: a label with no URL is a button that does nothing,
   * and a URL with no label is a link with nothing to click.
   */
  link: AnnouncementLink | null;
  /** Whether the window contains now — the list's *Showing now* badge. */
  showing: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AnnouncementInput {
  title: string;
  description?: string;
  startsAt: string | Date;
  endsAt: string | Date;
  /** Only meaningful with an image; ignored where there is none. */
  imagePlacement?: ImagePlacement | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
}

const COLUMNS = `id, organisation_id, title, description, starts_at, ends_at,
                 image_key, image_mime, image_placement, link_label, link_url,
                 created_at, updated_at`;

/** How long a member's browser may use an image URL before asking again. */
const IMAGE_URL_TTL_SECONDS = 3600;

function assertValidTitle(title: unknown): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) throw new ValidationError('An announcement needs a title');
  if (trimmed.length > 255) throw new ValidationError('The title is too long (255 characters)');
  return trimmed;
}

/**
 * The display window, checked before anything is written.
 *
 * A window that ends before it begins can never be shown, so nothing downstream
 * would ever report it as wrong — the club would simply never see their notice
 * and have no way to find out why. The database refuses it too; this is what
 * turns that refusal into a sentence an administrator can act on.
 */
function assertValidWindow(startsAt: unknown, endsAt: unknown): { starts: Date; ends: Date } {
  const starts = new Date(startsAt as string);
  const ends = new Date(endsAt as string);

  if (Number.isNaN(starts.getTime())) throw new ValidationError('Enter when this starts showing');
  if (Number.isNaN(ends.getTime())) throw new ValidationError('Enter when this stops showing');
  if (ends <= starts) throw new ValidationError('Shows until must be after shows from');

  return { starts, ends };
}

/**
 * Where a notice points, checked before it is stored.
 *
 * **Both halves or neither.** The same rule the platform's posts apply, and for
 * the same reason: half a link has nothing sensible to render.
 *
 * **`http` and `https` only.** A club administrator's account is a much softer
 * target than the platform, and this button is rendered on every member's home
 * page — a `javascript:` URL there is stored XSS aimed at the whole club.
 * Refused on the way in rather than stripped on the way out, because somebody
 * who typed a bad URL should be told, not silently ignored. `mailto:` is
 * excluded too: a button that opens a mail client when it looks like it opens a
 * page is a small betrayal of the reader.
 */
function normaliseLink(label: unknown, url: unknown): AnnouncementLink | null {
  const text = typeof label === 'string' ? label.trim() : '';
  const href = typeof url === 'string' ? url.trim() : '';

  if (!text && !href) return null;
  if (!text || !href) {
    throw new ValidationError('A link needs both the words on the button and a web address');
  }
  if (text.length > 120) {
    throw new ValidationError('The link text is too long (120 characters)');
  }

  let parsed: URL;
  try {
    parsed = new URL(href);
  } catch {
    throw new ValidationError(`"${href}" is not a valid link. Include http:// or https://`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Links must start with http:// or https://');
  }

  return { label: text, url: href };
}

function normalisePlacement(placement: unknown): ImagePlacement | null {
  if (placement === null || placement === undefined || placement === '') return null;
  if (!IMAGE_PLACEMENTS.includes(placement as ImagePlacement)) {
    throw new ValidationError('Choose how the image is used: background, header or footer');
  }
  return placement as ImagePlacement;
}

export class AnnouncementService {
  /**
   * One row as the API returns it.
   *
   * `async` only because the signed URL is: the alternative is returning keys
   * and making every caller sign them, and the two callers are an org-admin
   * screen and a member's home page — the second of which would then be the one
   * that forgot.
   */
  private async toAnnouncement(row: any, now: Date = new Date()): Promise<Announcement> {
    let imageUrl: string | null = null;
    if (row.image_key) {
      try {
        imageUrl = await fileUploadService.getFileUrl(row.image_key, IMAGE_URL_TTL_SECONDS);
      } catch (error) {
        /*
         * A missing object must not take the announcement down with it. The
         * words are the announcement; the picture is decoration, and a club
         * whose S3 object went astray would otherwise lose the notice entirely
         * and have no idea why.
         */
        logger.warn('Could not sign an announcement image URL', { id: row.id, error });
      }
    }

    return {
      id: row.id,
      organisationId: row.organisation_id,
      title: row.title,
      description: row.description ?? '',
      startsAt: new Date(row.starts_at).toISOString(),
      endsAt: new Date(row.ends_at).toISOString(),
      imageUrl,
      // Null where there is no image, whatever the column happens to hold: a
      // card claiming a background it has no picture for is not renderable.
      imagePlacement: row.image_key ? (row.image_placement ?? null) : null,
      // The column pair is constrained to be both-or-neither, so this reads as
      // one fact rather than two that a renderer would have to reconcile.
      link: row.link_label && row.link_url ? { label: row.link_label, url: row.link_url } : null,
      showing: new Date(row.starts_at) <= now && new Date(row.ends_at) > now,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  private async toAnnouncements(rows: any[], now?: Date): Promise<Announcement[]> {
    return Promise.all(rows.map((row) => this.toAnnouncement(row, now)));
  }

  /** Every announcement a club has, finished ones included. For the admin list. */
  async list(organisationId: string): Promise<Announcement[]> {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM organisation_announcements
        WHERE organisation_id = $1
        ORDER BY starts_at DESC, created_at DESC`,
      [organisationId]
    );
    return this.toAnnouncements(result.rows);
  }

  /**
   * One announcement, for the editor.
   *
   * Scoped by organisation as well as by id. The route's guard already
   * authorises the club, but an id from another one must not resolve here
   * either — a 404 rather than a 403, because confirming the id exists is the
   * leak.
   */
  async get(organisationId: string, id: string): Promise<Announcement> {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM organisation_announcements WHERE id = $1 AND organisation_id = $2`,
      [id, organisationId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Announcement not found');
    return this.toAnnouncement(result.rows[0]);
  }

  /**
   * What a member sees now.
   *
   * The window is applied here, in the database, rather than by filtering a
   * fuller list in the client: the clock that decides is the one the club's
   * dates were written against.
   *
   * Newest first, so a notice posted this morning is the first thing read.
   */
  async activeFor(organisationId: string, now: Date = new Date()): Promise<Announcement[]> {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM organisation_announcements
        WHERE organisation_id = $1 AND starts_at <= $2 AND ends_at > $2
        ORDER BY starts_at DESC, created_at DESC`,
      [organisationId, now]
    );
    return this.toAnnouncements(result.rows, now);
  }

  async create(
    organisationId: string,
    input: AnnouncementInput,
    createdBy: string | null = null
  ): Promise<Announcement> {
    const title = assertValidTitle(input.title);
    const { starts, ends } = assertValidWindow(input.startsAt, input.endsAt);
    const placement = normalisePlacement(input.imagePlacement);
    const link = normaliseLink(input.linkLabel, input.linkUrl);

    const result = await db.query(
      `INSERT INTO organisation_announcements
         (organisation_id, title, description, starts_at, ends_at, image_placement,
          link_label, link_url, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
       RETURNING ${COLUMNS}`,
      [
        organisationId,
        title,
        input.description ?? '',
        starts,
        ends,
        placement,
        link?.label ?? null,
        link?.url ?? null,
        createdBy,
      ]
    );

    logger.info('Announcement created', { organisationId, id: result.rows[0].id });
    return this.toAnnouncement(result.rows[0]);
  }

  async update(
    organisationId: string,
    id: string,
    input: AnnouncementInput
  ): Promise<Announcement> {
    const title = assertValidTitle(input.title);
    const { starts, ends } = assertValidWindow(input.startsAt, input.endsAt);
    const placement = normalisePlacement(input.imagePlacement);
    const link = normaliseLink(input.linkLabel, input.linkUrl);

    const result = await db.query(
      `UPDATE organisation_announcements
          SET title = $3, description = $4, starts_at = $5, ends_at = $6,
              image_placement = $7, link_label = $8, link_url = $9, updated_at = NOW()
        WHERE id = $1 AND organisation_id = $2
        RETURNING ${COLUMNS}`,
      [
        id,
        organisationId,
        title,
        input.description ?? '',
        starts,
        ends,
        placement,
        link?.label ?? null,
        link?.url ?? null,
      ]
    );
    if (result.rows.length === 0) throw new NotFoundError('Announcement not found');
    return this.toAnnouncement(result.rows[0]);
  }

  /** Removes the row, and reports the image key so the object can be tidied. */
  async remove(organisationId: string, id: string): Promise<{ imageKey: string | null }> {
    const result = await db.query(
      `DELETE FROM organisation_announcements
        WHERE id = $1 AND organisation_id = $2
        RETURNING image_key`,
      [id, organisationId]
    );
    if (result.rows.length === 0) throw new NotFoundError('Announcement not found');
    return { imageKey: result.rows[0].image_key ?? null };
  }

  /**
   * Attach an uploaded image, and say what it replaced.
   *
   * A placement comes with it: an image with nowhere to go renders as nothing,
   * and the commonest way to reach that state is uploading a picture and
   * forgetting the radio buttons. `header` is the default because it is the one
   * placement that cannot make text unreadable.
   */
  async setImage(
    organisationId: string,
    id: string,
    image: { s3Key: string; mimeType: string; placement?: ImagePlacement | null }
  ): Promise<{ announcement: Announcement; previousKey: string | null }> {
    const previous = await db.query(
      `SELECT image_key FROM organisation_announcements WHERE id = $1 AND organisation_id = $2`,
      [id, organisationId]
    );
    if (previous.rows.length === 0) throw new NotFoundError('Announcement not found');

    const result = await db.query(
      `UPDATE organisation_announcements
          SET image_key = $3, image_mime = $4,
              image_placement = COALESCE($5, image_placement, 'header'),
              updated_at = NOW()
        WHERE id = $1 AND organisation_id = $2
        RETURNING ${COLUMNS}`,
      [id, organisationId, image.s3Key, image.mimeType, normalisePlacement(image.placement)]
    );

    return {
      announcement: await this.toAnnouncement(result.rows[0]),
      previousKey: previous.rows[0].image_key ?? null,
    };
  }

  /**
   * Forget the image, and report the key that was there.
   *
   * The previous key is read before the update rather than from `RETURNING`,
   * which gives the **new** row: `UPDATE … SET image_key = NULL … RETURNING
   * image_key` returns the null it has just written, so every removed picture
   * would stay in the bucket forever. `platform_posts` learned this the hard
   * way; `RETURNING OLD.*` arrives in PG18.
   */
  async clearImage(
    organisationId: string,
    id: string
  ): Promise<{ announcement: Announcement; previousKey: string | null }> {
    const previous = await db.query(
      `SELECT image_key FROM organisation_announcements WHERE id = $1 AND organisation_id = $2`,
      [id, organisationId]
    );
    if (previous.rows.length === 0) throw new NotFoundError('Announcement not found');

    const result = await db.query(
      `UPDATE organisation_announcements
          SET image_key = NULL, image_mime = NULL, image_placement = NULL, updated_at = NOW()
        WHERE id = $1 AND organisation_id = $2
        RETURNING ${COLUMNS}`,
      [id, organisationId]
    );

    return {
      announcement: await this.toAnnouncement(result.rows[0]),
      previousKey: previous.rows[0].image_key ?? null,
    };
  }
}

export const announcementService = new AnnouncementService();
