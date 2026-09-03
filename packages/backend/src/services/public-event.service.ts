import { db } from '../database/pool';

/**
 * Events a club has published to the public.
 *
 * Everything here is served to **anonymous** callers, which is the whole reason
 * it is a separate service rather than a flag on the member catalogue. Two rules
 * follow from that and are applied in one place so they cannot drift:
 *
 *  - **Nothing about people.** No entrants, no member names, no counts that
 *    could identify anyone. A public page reports what is on offer, never who
 *    took it.
 *  - **Published means published twice.** An event reaches the public only if
 *    the club published it to its own members *and* switched public listing on.
 *    A draft cannot leak to the world by ticking a second box.
 *
 * Entry windows and capacity are computed the same way the member catalogue
 * computes them. They are not re-derived here — a second opinion about whether
 * entries are open would eventually disagree with the first, and the two would
 * be wrong in different places.
 *
 * See docs/PUBLIC_EVENTS.md.
 */

export interface PublicActivity {
  id: string;
  name: string;
  description: string | null;
  /** Minor units. */
  fee: number;
  entriesLimit: number | null;
  placesRemaining: number | null;
  /**
   * Restricted to members, and which kind.
   *
   * Listed rather than hidden: a show with eight classes would look like it had
   * three, and "members only" tells a reader something true — that joining is
   * the way in. It is never presented as enterable.
   */
  membersOnly: boolean;
  membersOnlyScope: 'club' | 'organisation-type' | null;
}

export interface PublicEvent {
  id: string;
  /** `spring-show-jumping-league-a1b2c3` — words for the reader, id for the lookup. */
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
  /** Present only when the venue has been geocoded; drives `schema.org` `geo`. */
  location: { latitude: number; longitude: number } | null;
  organisation: { code: string; name: string; currency: string };
  activities: PublicActivity[];
  /** When the record last changed — `lastmod` in the sitemap. */
  updatedAt: string;
}

export interface PublicEventFilters {
  q?: string;
  eventType?: string[];
  region?: string[];
  organisation?: string[];
  from?: Date;
  to?: Date;
  /** Only events whose entry window is open right now. */
  entriesOpen?: boolean;
  /**
   * Include events that have already happened.
   *
   * Off by default: this drives a discovery page. The sitemap and the per-event
   * pages want them, and ask.
   */
  includeFinished?: boolean;
  sort?: 'soonest' | 'closing' | 'recent' | 'organisation';
  limit?: number;
  offset?: number;
}

/**
 * The words in an event's URL, and the id that actually resolves it.
 *
 * The suffix is the first segment of the uuid rather than a counter: it is
 * stable, needs no extra column, and cannot collide. Renaming an event changes
 * the words and not the suffix, which is what lets the old URL redirect to the
 * new one instead of breaking.
 *
 * **Not `slugifyUrlCode`**, despite the obvious overlap. That helper is built
 * for organisation codes, which occupy a path segment on their own: it enforces
 * a minimum length and appends `-org` to anything reserved or too short, so an
 * event named "!!!" would be published at `/whats-on/org-a1b2c3d4`. An event
 * slug needs neither rule — it always carries an id and never competes for the
 * organisation namespace — so it does the plain transformation and stops.
 */
export const slugFor = (id: string, name: string): string => {
  const words = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  const suffix = id.split('-')[0];
  return words ? `${words}-${suffix}` : suffix;
};

/** The uuid prefix a slug ends with, or null if it carries none. */
export const idPrefixFromSlug = (slug: string): string | null => {
  const match = /([0-9a-f]{8})$/i.exec(slug);
  return match ? match[1].toLowerCase() : null;
};

/** Sorts, as SQL. Named rather than interpolated — the value comes from a query string. */
const ORDER_BY: Record<NonNullable<PublicEventFilters['sort']>, string> = {
  soonest: 'e.start_date ASC NULLS LAST, e.name ASC',
  closing: 'e.entries_closing_date ASC NULLS LAST, e.start_date ASC',
  recent: 'e.updated_at DESC',
  organisation: 'o.display_name ASC, e.start_date ASC',
};

/**
 * The columns every public read needs, and the joins behind them.
 *
 * One projection for the club page, the platform page, a single event and the
 * sitemap. They differ only in their `WHERE`, and writing the shape four times
 * is how one of them ends up exposing a column the others do not.
 */
const SELECT = `
  SELECT e.id, e.name, e.description, e.start_date, e.end_date,
         e.open_date_entries, e.entries_closing_date,
         e.limit_entries, e.entries_limit, e.updated_at,
         et.name  AS event_type,
         v.name   AS venue_name, v.address AS venue_address, v.region AS venue_region,
         v.latitude, v.longitude,
         o.url_code, o.display_name AS organisation_name,
         COALESCE(o.settings->>'currency', ot.currency) AS currency,
         (SELECT COUNT(*) FROM event_entries ee
           WHERE ee.event_id = e.id AND ee.entry_status <> 'removed') AS entry_count
    FROM events e
    JOIN organizations o        ON o.id  = e.organisation_id
    JOIN organization_types ot  ON ot.id = o.organization_type_id
    LEFT JOIN event_types et    ON et.id = e.event_type_id
    LEFT JOIN venues v          ON v.id  = e.venue_id
`;

/**
 * Public at all: published by the club, not deleted, and the club still active.
 *
 * `end_date` is deliberately **not** filtered here. A finished event keeps its
 * page — it holds whatever search ranking it earned, repeat events benefit from
 * a URL with history, and a club's past programme is evidence they are worth
 * joining. The listings order it away; they do not delete it.
 */
const PUBLIC_WHERE = `
  e.status = 'published'
  AND e.deleted = FALSE
  AND o.status = 'active'
`;

export class PublicEventService {
  /** One club's public events, for `/{orgCode}/whats-on`. */
  async listForOrganisation(orgCode: string): Promise<PublicEvent[]> {
    const result = await db.query(
      `${SELECT}
        WHERE ${PUBLIC_WHERE}
          AND e.show_on_organisation_page
          AND lower(o.url_code) = lower($1)
        ORDER BY ${ORDER_BY.soonest}`,
      [orgCode]
    );
    return this.withActivities(result.rows);
  }

  /** The platform listing, for `/events`. */
  async search(
    filters: PublicEventFilters
  ): Promise<{ events: PublicEvent[]; total: number }> {
    const where: string[] = [PUBLIC_WHERE, 'e.show_on_platform_page'];
    const params: any[] = [];

    /*
     * Finished events are not on the discovery page.
     *
     * They **keep their own page** — that URL holds whatever search ranking it
     * earned and a club's past programme is evidence it is worth joining — but
     * a listing headed "What's on" is answering a different question, and
     * sorting by date ascending put last July's show at the very top of it.
     *
     * The club's own programme page keeps them too, under a "Previously"
     * heading, where a reader has already chosen that club and its history is
     * part of the answer. Here it is just noise between them and an event they
     * could enter.
     */
    if (!filters.includeFinished) {
      where.push('e.end_date >= CURRENT_DATE');
    }

    if (filters.q) {
      params.push(`%${filters.q}%`);
      const p = `$${params.length}`;
      /*
       * The venue address is searched as well as its name, so "Kildare" finds
       * an event whose region has not been filled in yet. That is what keeps
       * the region field's absence from making events invisible.
       */
      where.push(
        `(e.name ILIKE ${p} OR e.description ILIKE ${p} OR o.display_name ILIKE ${p}
          OR v.name ILIKE ${p} OR v.address ILIKE ${p})`
      );
    }
    if (filters.eventType?.length) {
      params.push(filters.eventType);
      where.push(`et.name = ANY($${params.length}::text[])`);
    }
    if (filters.region?.length) {
      params.push(filters.region);
      where.push(`v.region = ANY($${params.length}::text[])`);
    }
    if (filters.organisation?.length) {
      params.push(filters.organisation);
      where.push(`o.url_code = ANY($${params.length}::text[])`);
    }
    if (filters.from) {
      params.push(filters.from);
      where.push(`e.end_date >= $${params.length}`);
    }
    if (filters.to) {
      params.push(filters.to);
      where.push(`e.start_date <= $${params.length}`);
    }
    if (filters.entriesOpen) {
      where.push(`
        (e.open_date_entries IS NULL OR e.open_date_entries <= NOW())
        AND (e.entries_closing_date IS NULL OR e.entries_closing_date >= NOW())
      `);
    }

    const clause = where.join(' AND ');
    const order = ORDER_BY[filters.sort ?? 'soonest'];

    const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100);
    const offset = Math.max(filters.offset ?? 0, 0);

    const [rows, count] = await Promise.all([
      db.query(
        `${SELECT} WHERE ${clause} ORDER BY ${order}
          LIMIT ${limit} OFFSET ${offset}`,
        params
      ),
      db.query(
        `SELECT COUNT(*) AS total
           FROM events e
           JOIN organizations o ON o.id = e.organisation_id
           JOIN organization_types ot ON ot.id = o.organization_type_id
           LEFT JOIN event_types et ON et.id = e.event_type_id
           LEFT JOIN venues v ON v.id = e.venue_id
          WHERE ${clause}`,
        params
      ),
    ]);

    return {
      events: await this.withActivities(rows.rows),
      total: Number(count.rows[0]?.total ?? 0),
    };
  }

  /**
   * One event by the id embedded in its slug.
   *
   * Resolved by id, never by the words: an event renamed after a club shared the
   * link must still answer on the old URL. The caller compares the canonical
   * slug against what was asked for and redirects when they differ.
   */
  async findBySlug(
    orgCode: string,
    slug: string
  ): Promise<{ event: PublicEvent; canonicalSlug: string } | null> {
    const prefix = idPrefixFromSlug(slug);
    if (!prefix) return null;

    const result = await db.query(
      `${SELECT}
        WHERE ${PUBLIC_WHERE}
          AND (e.show_on_organisation_page OR e.show_on_platform_page)
          AND lower(o.url_code) = lower($1)
          AND e.id::text LIKE $2 || '%'
        LIMIT 1`,
      [orgCode, prefix]
    );
    if (result.rows.length === 0) return null;

    const [event] = await this.withActivities(result.rows);
    return { event, canonicalSlug: event.slug };
  }

  /**
   * Did this event exist and stop being public?
   *
   * The difference between `404` and `410`, and it is not pedantry: `404` means
   * "not found", which invites a crawler to keep asking for weeks, while `410`
   * says the page is gone and it is dropped promptly. An event a club withdraws
   * after sharing it publicly is genuinely gone, and leaving it as a 404 keeps
   * a dead link in results long after the club stopped advertising it.
   *
   * Asked only once `findBySlug` has come back empty, so it costs nothing on
   * the ordinary path.
   */
  async wasPublic(orgCode: string, slug: string): Promise<boolean> {
    const prefix = idPrefixFromSlug(slug);
    if (!prefix) return false;

    const result = await db.query(
      `SELECT 1
         FROM events e
         JOIN organizations o ON o.id = e.organisation_id
        WHERE lower(o.url_code) = lower($1)
          AND e.id::text LIKE $2 || '%'
        LIMIT 1`,
      [orgCode, prefix]
    );
    return result.rows.length > 0;
  }

  /**
   * Every public event URL, for the sitemap.
   *
   * Deliberately lean — the sitemap needs an address and a date, not activities
   * — so this does not go near `withActivities`.
   */
  async listUrls(): Promise<Array<{ orgCode: string; slug: string; updatedAt: Date; startDate: Date }>> {
    const result = await db.query(
      `SELECT e.id, e.name, e.updated_at, e.start_date, o.url_code
         FROM events e
         JOIN organizations o ON o.id = e.organisation_id
        WHERE ${PUBLIC_WHERE}
          AND (e.show_on_organisation_page OR e.show_on_platform_page)
        ORDER BY e.updated_at DESC`,
      []
    );
    return result.rows.map((row) => ({
      orgCode: row.url_code,
      slug: slugFor(row.id, row.name),
      updatedAt: row.updated_at,
      startDate: row.start_date,
    }));
  }

  /**
   * The filter vocabularies, taken from what is actually in the public results.
   *
   * Not from the full `event_types` and `venues` tables: offering a filter that
   * returns nothing is worse than offering fewer filters, and the counts let the
   * interface show what a click will cost before it is spent.
   */
  async filterOptions(): Promise<{
    eventTypes: Array<{ value: string; count: number }>;
    regions: Array<{ value: string; count: number }>;
    organisations: Array<{ value: string; label: string; count: number }>;
  }> {
    const base = `
      FROM events e
      JOIN organizations o ON o.id = e.organisation_id
      LEFT JOIN event_types et ON et.id = e.event_type_id
      LEFT JOIN venues v ON v.id = e.venue_id
     WHERE ${PUBLIC_WHERE} AND e.show_on_platform_page
    `;

    const [types, regions, orgs] = await Promise.all([
      db.query(`SELECT et.name AS value, COUNT(*) AS count ${base} AND et.name IS NOT NULL
                 GROUP BY et.name ORDER BY et.name`),
      db.query(`SELECT v.region AS value, COUNT(*) AS count ${base} AND v.region IS NOT NULL
                 GROUP BY v.region ORDER BY v.region`),
      db.query(`SELECT o.url_code AS value, o.display_name AS label, COUNT(*) AS count ${base}
                 GROUP BY o.url_code, o.display_name ORDER BY o.display_name`),
    ]);

    const num = (rows: any[]) =>
      rows.map((row) => ({ ...row, count: Number(row.count) }));

    return {
      eventTypes: num(types.rows),
      regions: num(regions.rows),
      organisations: num(orgs.rows),
    };
  }

  /**
   * Attach each event's publicly visible activities.
   *
   * One query for the whole page rather than one per event. `show_publicly` is
   * the club's own switch for keeping a class off its list — a different thing
   * from public visibility, and honoured here for the same reason: a class the
   * club hides from members should not appear to the world.
   */
  private async withActivities(rows: any[]): Promise<PublicEvent[]> {
    if (rows.length === 0) return [];

    const activities = await db.query(
      `SELECT a.id, a.event_id, a.name, a.description, a.fee,
              a.limit_applicants, a.applicants_limit, a.entry_eligibility,
              (SELECT COUNT(*) FROM event_entries ee
                WHERE ee.event_activity_id = a.id AND ee.entry_status <> 'removed')
                AS entry_count
         FROM event_activities a
        WHERE a.event_id = ANY($1::uuid[])
          AND a.show_publicly = TRUE
        ORDER BY a.created_at ASC`,
      [rows.map((row) => row.id)]
    );

    const byEvent = new Map<string, PublicActivity[]>();
    for (const row of activities.rows) {
      const capped = row.limit_applicants && row.applicants_limit !== null;
      const remaining = capped
        ? Math.max(0, Number(row.applicants_limit) - Number(row.entry_count))
        : null;

      const list = byEvent.get(row.event_id) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        description: row.description ?? null,
        fee: row.fee === null ? 0 : Math.round(Number(row.fee) * 100),
        entriesLimit: capped ? Number(row.applicants_limit) : null,
        placesRemaining: remaining,
        membersOnly: row.entry_eligibility !== 'all',
        membersOnlyScope:
          row.entry_eligibility === 'members'
            ? 'club'
            : row.entry_eligibility === 'org-type-members'
              ? 'organisation-type'
              : null,
      });
      byEvent.set(row.event_id, list);
    }

    return rows.map((row) => {
      const capped = row.limit_entries && row.entries_limit !== null;
      return {
        id: row.id,
        slug: slugFor(row.id, row.name),
        name: row.name,
        description: row.description,
        startDate: new Date(row.start_date).toISOString(),
        endDate: new Date(row.end_date).toISOString(),
        entriesOpenDate: row.open_date_entries
          ? new Date(row.open_date_entries).toISOString()
          : null,
        entriesClosingDate: row.entries_closing_date
          ? new Date(row.entries_closing_date).toISOString()
          : null,
        entriesLimit: capped ? Number(row.entries_limit) : null,
        placesRemaining: capped
          ? Math.max(0, Number(row.entries_limit) - Number(row.entry_count))
          : null,
        eventType: row.event_type ?? null,
        venue: row.venue_name
          ? {
              name: row.venue_name,
              address: row.venue_address ?? null,
              region: row.venue_region ?? null,
            }
          : null,
        location:
          row.latitude !== null && row.longitude !== null
            ? { latitude: Number(row.latitude), longitude: Number(row.longitude) }
            : null,
        organisation: {
          code: row.url_code,
          name: row.organisation_name,
          currency: row.currency ?? 'EUR',
        },
        activities: byEvent.get(row.id) ?? [],
        updatedAt: new Date(row.updated_at).toISOString(),
      };
    });
  }
}

export const publicEventService = new PublicEventService();
