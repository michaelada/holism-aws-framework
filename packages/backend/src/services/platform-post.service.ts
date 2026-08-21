import crypto from 'crypto';
import DOMPurify from 'isomorphic-dompurify';
import { db } from '../database/pool';
import { ValidationError, NotFoundError } from '../middleware/errors';

/**
 * Announcements the platform shows on the two login pages.
 *
 * Written by an ItsPlainSailing super admin, read by everybody signing in to
 * either application. The login page is the one screen every user passes
 * through, which is what makes it worth writing to and what makes a mistake
 * here expensive: a broken post is seen by the entire platform at once, by
 * people who are not signed in and mostly cannot report it.
 *
 * Two things follow from that audience and are the substance of this file.
 *
 * **The public read is sanitised here, not by its callers.** There are two of
 * them and they are not alike: the account application renders posts through
 * React, and the Keycloak login theme renders them with a hand-written script
 * that has no sanitiser available to it at all. Leaving it to the caller means
 * leaving it to the one that cannot do it. So `listForSurface` returns HTML
 * that is already safe, and the admin read — which feeds an editor and must
 * round-trip exactly — returns it untouched.
 *
 * **Link URLs are checked on write.** A post's links are rendered as anchors on
 * an anonymous page, so a `javascript:` URL is stored XSS aimed at everyone who
 * signs in. Refused on the way in rather than stripped on the way out, because
 * an author who typed a bad URL should be told, not silently ignored.
 */

export interface PostLink {
  label: string;
  url: string;
}

export interface PlatformPost {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  links: PostLink[];
  status: 'active' | 'inactive';
  showOnAccountLogin: boolean;
  showOnOrgadminLogin: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlatformPostInput {
  title: string;
  body?: string;
  links?: PostLink[];
  status?: 'active' | 'inactive';
  showOnAccountLogin?: boolean;
  showOnOrgadminLogin?: boolean;
}

export type PostSurface = 'account' | 'orgadmin';

/** The column each surface flag lives in. Never interpolated from a caller. */
const SURFACE_COLUMN: Record<PostSurface, string> = {
  account: 'show_on_account_login',
  orgadmin: 'show_on_orgadmin_login',
};

/**
 * What a post's body may contain once it reaches a login page.
 *
 * Deliberately narrow. This is an announcement, not a web page: it needs
 * emphasis, lists, links and line breaks. Everything that could load or run
 * something — script, iframe, object, form, style — is absent by construction
 * rather than by a blocklist, because a blocklist is a list somebody has to
 * keep complete.
 */
const BODY_ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'a', 'span',
];

export function sanitiseBody(html: string): string {
  return DOMPurify.sanitize(html ?? '', {
    ALLOWED_TAGS: BODY_ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    // `javascript:` and `data:` in an href, closed off explicitly rather than
    // relying on the default list staying as it is.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });
}

/**
 * Whether a link is safe to render as an anchor on an anonymous page.
 *
 * Only http and https. `mailto:` is deliberately excluded here even though the
 * body allows it — these render as buttons under a post, and a button that
 * opens a mail client when it looks like it opens a page is a small betrayal of
 * the reader rather than a feature anyone asked for.
 */
function assertSafeUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError(`"${url}" is not a valid link. Include http:// or https://`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Links must start with http:// or https://');
  }
}

function normaliseLinks(links: unknown): PostLink[] {
  if (links === undefined || links === null) return [];
  if (!Array.isArray(links)) {
    throw new ValidationError('Links must be a list');
  }

  return links.map((raw) => {
    const label = typeof raw?.label === 'string' ? raw.label.trim() : '';
    const url = typeof raw?.url === 'string' ? raw.url.trim() : '';

    if (!label || !url) {
      // Both or neither: a link with no text is invisible, and one with no
      // destination is a button that does nothing.
      throw new ValidationError('Every link needs both display text and a URL');
    }
    assertSafeUrl(url);
    return { label, url };
  });
}

function assertValidTitle(title: unknown): string {
  const trimmed = typeof title === 'string' ? title.trim() : '';
  if (!trimmed) throw new ValidationError('A post needs a title');
  if (trimmed.length > 255) throw new ValidationError('The title is too long (255 characters)');
  return trimmed;
}

/**
 * The image is served by the platform, at a path that changes with the image.
 *
 * Not a signed S3 URL: these are read by an anonymous login page and by a
 * Keycloak theme, and an expiring URL would have to be refreshed by both.
 *
 * **The `v` token is what makes the path safe to cache**, and leaving it out
 * was a real bug. The path was `/posts/:id/image` — derived from the post,
 * which does not change when its picture does — so replacing an image left
 * every browser that had seen the old one serving it from cache, and removing
 * an image left it on screen until the cached copy expired. An operator swapped
 * a picture, looked at the login page, and saw the old one looking back.
 *
 * Derived from the S3 key, which is uniquified per upload, so it changes
 * exactly when the bytes do and not otherwise — a fresh token on every read
 * would defeat caching just as thoroughly in the other direction. The route
 * ignores the value; only the browser reads it.
 */
function imageUrlFor(row: any): string | null {
  if (!row.image_key) return null;
  const version = crypto.createHash('sha1').update(row.image_key).digest('hex').slice(0, 12);
  return `/api/public/posts/${row.id}/image?v=${version}`;
}

function toPost(row: any, options: { sanitise: boolean }): PlatformPost {
  return {
    id: row.id,
    title: row.title,
    body: options.sanitise ? sanitiseBody(row.body) : row.body,
    imageUrl: imageUrlFor(row),
    links: Array.isArray(row.links) ? row.links : JSON.parse(row.links ?? '[]'),
    status: row.status,
    showOnAccountLogin: row.show_on_account_login,
    showOnOrgadminLogin: row.show_on_orgadmin_login,
    displayOrder: row.display_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const COLUMNS = `id, title, body, image_key, image_mime, links, status,
                 show_on_account_login, show_on_orgadmin_login, display_order,
                 created_at, updated_at`;

class PlatformPostService {
  /** Every post, in the arranged order. For the admin screens. */
  async list(): Promise<PlatformPost[]> {
    const result = await db.query(
      `SELECT ${COLUMNS} FROM platform_posts ORDER BY display_order ASC, created_at ASC`
    );
    return result.rows.map((row) => toPost(row, { sanitise: false }));
  }

  async get(id: string): Promise<PlatformPost> {
    const result = await db.query(`SELECT ${COLUMNS} FROM platform_posts WHERE id = $1`, [id]);
    if (result.rows.length === 0) throw new NotFoundError('Post not found');
    return toPost(result.rows[0], { sanitise: false });
  }

  /**
   * The posts one login page should show, sanitised and in order.
   *
   * Both conditions matter and they are different questions: `status` is
   * whether the post is finished, the surface flag is where it belongs. A post
   * can be active and shown on neither page — that is a draft that has been
   * proof-read, not a mistake.
   */
  async listForSurface(surface: PostSurface): Promise<PlatformPost[]> {
    const column = SURFACE_COLUMN[surface];
    if (!column) throw new ValidationError('Unknown surface');

    const result = await db.query(
      `SELECT ${COLUMNS}
         FROM platform_posts
        WHERE status = 'active'
          AND ${column} = TRUE
        ORDER BY display_order ASC, created_at ASC`
    );
    return result.rows.map((row) => toPost(row, { sanitise: true }));
  }

  async create(input: PlatformPostInput): Promise<PlatformPost> {
    const title = assertValidTitle(input.title);
    const links = normaliseLinks(input.links);

    /*
     * New posts go to the end. Appending is what an author expects, and it is
     * also the only choice that cannot reorder anything they already arranged.
     */
    const result = await db.query(
      `INSERT INTO platform_posts
         (title, body, links, status, show_on_account_login, show_on_orgadmin_login,
          display_order, created_at, updated_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6,
               COALESCE((SELECT MAX(display_order) + 1 FROM platform_posts), 0),
               NOW(), NOW())
       RETURNING ${COLUMNS}`,
      [
        title,
        input.body ?? '',
        JSON.stringify(links),
        input.status === 'active' ? 'active' : 'inactive',
        input.showOnAccountLogin === true,
        input.showOnOrgadminLogin === true,
      ]
    );
    return toPost(result.rows[0], { sanitise: false });
  }

  async update(id: string, input: PlatformPostInput): Promise<PlatformPost> {
    const title = assertValidTitle(input.title);
    const links = normaliseLinks(input.links);

    const result = await db.query(
      `UPDATE platform_posts
          SET title = $2, body = $3, links = $4::jsonb, status = $5,
              show_on_account_login = $6, show_on_orgadmin_login = $7,
              updated_at = NOW()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [
        id,
        title,
        input.body ?? '',
        JSON.stringify(links),
        input.status === 'active' ? 'active' : 'inactive',
        input.showOnAccountLogin === true,
        input.showOnOrgadminLogin === true,
      ]
    );
    if (result.rows.length === 0) throw new NotFoundError('Post not found');
    return toPost(result.rows[0], { sanitise: false });
  }

  /** Returns the image key, if there was one, so the caller can tidy up S3. */
  async remove(id: string): Promise<{ imageKey: string | null }> {
    const result = await db.query(
      `DELETE FROM platform_posts WHERE id = $1 RETURNING image_key`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Post not found');
    return { imageKey: result.rows[0].image_key ?? null };
  }

  /**
   * Rewrite the arrangement from a list of ids.
   *
   * The whole order in one statement, rather than a move-up/move-down that
   * writes two rows: two concurrent moves against the same list produce an
   * order neither operator asked for, and this way the last writer's
   * arrangement is simply the one that stands.
   *
   * Ids not in the list keep their place *after* the arranged ones, so a post
   * created in another tab while the list was open cannot vanish from the
   * ordering.
   */
  async reorder(orderedIds: string[]): Promise<void> {
    if (!Array.isArray(orderedIds)) throw new ValidationError('Expected a list of post ids');
    if (orderedIds.length === 0) return;

    const unique = new Set(orderedIds);
    if (unique.size !== orderedIds.length) {
      throw new ValidationError('The same post appears more than once in the order');
    }

    await db.query(
      `UPDATE platform_posts AS p
          SET display_order = ordered.position,
              updated_at = NOW()
         FROM (SELECT id::uuid, position
                 FROM unnest($1::uuid[]) WITH ORDINALITY AS t(id, position)) AS ordered
        WHERE p.id = ordered.id`,
      [orderedIds]
    );
  }

  async setImage(id: string, image: { s3Key: string; mimeType: string }): Promise<PlatformPost> {
    const result = await db.query(
      `UPDATE platform_posts
          SET image_key = $2, image_mime = $3, updated_at = NOW()
        WHERE id = $1
        RETURNING ${COLUMNS}`,
      [id, image.s3Key, image.mimeType]
    );
    if (result.rows.length === 0) throw new NotFoundError('Post not found');
    return toPost(result.rows[0], { sanitise: false });
  }

  /**
   * Forget the image, and report the key that was there so S3 can be tidied.
   *
   * The CTE is the point. `UPDATE … SET image_key = NULL … RETURNING image_key`
   * reads perfectly and is wrong: Postgres `RETURNING` gives the **new** row, so
   * it returned the null it had just written, the caller saw "no previous
   * image", and every replaced or removed picture stayed in the bucket forever.
   * Reading the row first is the only way to have both values in one statement
   * on PG16 — `RETURNING OLD.*` arrived in 18.
   */
  async clearImage(id: string): Promise<{ imageKey: string | null }> {
    const result = await db.query(
      `WITH previous AS (
         SELECT id, image_key FROM platform_posts WHERE id = $1
       ), cleared AS (
         UPDATE platform_posts
            SET image_key = NULL, image_mime = NULL, updated_at = NOW()
          WHERE id = $1
          RETURNING id
       )
       SELECT previous.image_key FROM previous JOIN cleared ON cleared.id = previous.id`,
      [id]
    );
    if (result.rows.length === 0) throw new NotFoundError('Post not found');
    return { imageKey: result.rows[0].image_key ?? null };
  }

  /** What the public image route needs to stream the object. */
  async imageLocation(id: string): Promise<{ s3Key: string; mimeType: string } | null> {
    const result = await db.query(
      `SELECT image_key, image_mime FROM platform_posts WHERE id = $1 AND status = 'active'`,
      [id]
    );
    if (result.rows.length === 0 || !result.rows[0].image_key) return null;
    return {
      s3Key: result.rows[0].image_key,
      mimeType: result.rows[0].image_mime || 'application/octet-stream',
    };
  }
}

export const platformPostService = new PlatformPostService();
