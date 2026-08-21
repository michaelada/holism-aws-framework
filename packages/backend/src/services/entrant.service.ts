import { db } from '../database/pool';
import { ValidationError } from '../middleware/errors';

/**
 * Who an event entry is *for*.
 *
 * Every entry form now opens with a name, because the name was the one thing
 * every club was building by hand. A club that wanted to know which child was
 * riding put a "Rider name" text field at the top of its form; the next club
 * called it "Competitor"; a third forgot, and its entry list was a column of
 * account holders' names with no way to tell one family's three entries apart.
 * The name is not a question about the entry — it *is* the entry — so it stops
 * being something a form designer has to remember.
 *
 * ## Why the roster, and not the account's own memberships
 *
 * The members-only work answered a narrower question: which of *your* people
 * may enter. That is right for deciding eligibility and wrong for filling in a
 * name. Entries are made on other people's behalf all the time — a secretary
 * enters half the club, a parent enters the child whose membership is held on
 * the other parent's login — and a list containing only your own memberships
 * cannot express any of it.
 *
 * So the search here is over the **roster in scope**, not over the caller's
 * memberships. That is a deliberate widening and it is worth naming what it
 * costs: any signed-in account user of the club can see that a member exists,
 * and can enter them. The mitigations are that this is what the club's own
 * paper entry book has always allowed, that a caller must already be a
 * connected account user of the club to reach it at all, that nothing but a
 * name, a membership type and a number comes back — no email, no address, no
 * date of birth — and that a query shorter than {@link MIN_QUERY} returns
 * nothing, so the list cannot simply be asked for.
 *
 * ## Scope belongs to the activity, never to the caller
 *
 * The scope is derived here from the activity's `entry_eligibility` rather than
 * accepted as a parameter. A client that could name its own scope could ask an
 * open club event for the federation-wide roster, and the difference between
 * "my club's members" and "every club's members" is the whole of the
 * members-only feature. {@link searchEntrants} and {@link resolveEntrant} read
 * that scope through the same function so the list offered and the list
 * accepted cannot drift apart — the failure that would let a name be chosen and
 * then refused.
 */

/** The roster a given activity draws its entrants from. */
export type EntrantScope = 'organisation' | 'organisation-type';

/**
 * One typed name into the two columns `event_entries` keeps.
 *
 * Split on the *first* space, so "Mary O'Brien Kelly" keeps "O'Brien Kelly"
 * together as the surname rather than losing the last word. A single word is a
 * whole name — mononyms exist, and a club is perfectly entitled to enter
 * "Bluebell" for a pony — so the surname is left empty rather than the name
 * being rejected for having no space in it.
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const trimmed = (full ?? '').trim().replace(/\s+/g, ' ');
  const space = trimmed.indexOf(' ');
  return space === -1
    ? { firstName: trimmed, lastName: '' }
    : { firstName: trimmed.slice(0, space), lastName: trimmed.slice(space + 1) };
}

export interface EntrantCandidate {
  memberId: string;
  name: string;
  membershipTypeName: string;
  membershipNumber: string;
  /**
   * The club the membership is with — set only when it is *not* the club
   * running the event. Two members called Sarah Byrne in a federation-wide
   * rally are otherwise indistinguishable in a dropdown.
   */
  organisationName: string | null;
  /** Already entered in this activity, so offered but not selectable. */
  alreadyEntered: boolean;
}

/**
 * How the name field should behave for one activity.
 *
 * Computed on the server because every part of it is a fact about the club and
 * the activity, and a client that worked it out for itself would be a second
 * implementation of the eligibility rules.
 */
export interface EntrantFieldMode {
  /**
   * Whether there is a roster to complete against at all. False for a club
   * that does not run memberships, and for one that runs them but has no
   * active member yet — in both cases the field is a plain text box, which is
   * the correct answer rather than a degraded one.
   */
  autocomplete: boolean;
  /**
   * Whether a name that matches nobody may be submitted. True only for open
   * entries: on a members-only activity a free-typed name is precisely the
   * thing being excluded.
   */
  allowFreeText: boolean;
  scope: EntrantScope;
}

/**
 * Short queries are refused rather than answered.
 *
 * One letter would return most of the club, which turns a name field into a
 * roster download. Two is enough for a secretary who knows who they are looking
 * for and not enough to enumerate with.
 */
export const MIN_QUERY = 2;

/** Enough to choose from; few enough that the list is not the point. */
const MAX_RESULTS = 20;

type Eligibility = 'all' | 'members' | 'org-type-members';

const scopeFor = (eligibility: Eligibility): EntrantScope =>
  eligibility === 'org-type-members' ? 'organisation-type' : 'organisation';

/**
 * The activity's eligibility, read straight from the row.
 *
 * Deliberately not `accountCatalogueService.findActivity`, which builds a whole
 * catalogue to answer it: this runs on every keystroke.
 */
async function eligibilityOf(
  organisationId: string,
  activityId: string
): Promise<Eligibility> {
  const result = await db.query(
    `SELECT a.entry_eligibility
       FROM event_activities a
       JOIN events e ON e.id = a.event_id
      WHERE a.id = $1
        AND e.organisation_id = $2`,
    [activityId, organisationId]
  );

  if (result.rows.length === 0) {
    // Another club's activity, or none. Refused rather than defaulted: a
    // default here would answer with a roster for an event that is not theirs.
    throw new ValidationError('That activity could not be found');
  }

  const value = result.rows[0].entry_eligibility;
  return value === 'members' || value === 'org-type-members' ? value : 'all';
}

/**
 * The `WHERE` that defines "an active member in scope", and its parameters.
 *
 * One definition, used by the search and by the check that accepts a chosen
 * member, because these two agreeing is the whole safety property. `valid_until`
 * is compared as well as `status`: a lapsed membership keeps `status = 'active'`
 * until something sweeps it, and a rally in July must not accept a card that
 * expired in March.
 */
function scopeClause(scope: EntrantScope, organisationId: string, today: Date) {
  return scope === 'organisation-type'
    ? {
        sql: `o.organization_type_id = (
                SELECT organization_type_id FROM organizations WHERE id = $1
              )
              AND m.status = 'active'
              AND m.valid_until >= $2`,
        params: [organisationId, today] as any[],
      }
    : {
        sql: `m.organisation_id = $1
              AND m.status = 'active'
              AND m.valid_until >= $2`,
        params: [organisationId, today] as any[],
      };
}

class EntrantService {
  /**
   * How the name field should behave for this activity.
   *
   * The "has active members" test is run against the *same* scope the search
   * will use. Asking whether the host club has members would offer a plain text
   * box on a federation-wide rally run by a small branch, while the roster it
   * would have completed against was sitting in the other twenty clubs.
   */
  async fieldMode(
    organisationId: string,
    activityId: string,
    today: Date = new Date()
  ): Promise<EntrantFieldMode> {
    const eligibility = await eligibilityOf(organisationId, activityId);
    const scope = scopeFor(eligibility);

    const capability = await db.query(
      `SELECT 1
         FROM organizations
        WHERE id = $1
          AND enabled_capabilities @> '["memberships"]'::jsonb`,
      [organisationId]
    );

    let autocomplete = capability.rows.length > 0;

    if (autocomplete) {
      const clause = scopeClause(scope, organisationId, today);
      const anyMember = await db.query(
        `SELECT 1
           FROM members m
           JOIN organizations o ON o.id = m.organisation_id
          WHERE ${clause.sql}
          LIMIT 1`,
        clause.params
      );
      autocomplete = anyMember.rows.length > 0;
    }

    return { autocomplete, allowFreeText: eligibility === 'all', scope };
  }

  /**
   * Active members in scope whose name or membership number matches.
   *
   * Ordered by name rather than by relevance: a secretary scanning for "Byrne"
   * is reading a list of Byrnes, and a ranking they cannot see would only make
   * the same list arrive in an order they cannot predict.
   */
  async searchEntrants(
    organisationId: string,
    activityId: string,
    query: string,
    today: Date = new Date()
  ): Promise<EntrantCandidate[]> {
    const trimmed = (query ?? '').trim();
    if (trimmed.length < MIN_QUERY) return [];

    const eligibility = await eligibilityOf(organisationId, activityId);
    const scope = scopeFor(eligibility);
    const clause = scopeClause(scope, organisationId, today);
    const like = `%${trimmed}%`;

    const result = await db.query(
      `SELECT m.id, m.first_name, m.last_name, m.membership_number,
              m.organisation_id,
              mt.name AS membership_type_name,
              o.display_name AS organisation_name,
              EXISTS (
                SELECT 1 FROM event_entries ee
                 WHERE ee.event_activity_id = $${clause.params.length + 1}
                   AND ee.member_id = m.id
              ) AS already_entered
         FROM members m
         JOIN membership_types mt ON mt.id = m.membership_type_id
         JOIN organizations o ON o.id = m.organisation_id
        WHERE ${clause.sql}
          AND (
                (m.first_name || ' ' || m.last_name) ILIKE $${clause.params.length + 2}
             OR m.membership_number ILIKE $${clause.params.length + 2}
              )
        ORDER BY m.first_name, m.last_name
        LIMIT ${MAX_RESULTS}`,
      [...clause.params, activityId, like]
    );

    return result.rows.map((row) => this.toCandidate(row, organisationId));
  }

  /**
   * The member behind a chosen id, or a refusal.
   *
   * This is the check that matters: the search decides what is *offered*, and a
   * caller posting straight to the cart never ran it. Same scope, same
   * definition of active, so anything the field would not have offered is
   * refused here.
   */
  async resolveEntrant(
    organisationId: string,
    activityId: string,
    memberId: string,
    today: Date = new Date()
  ): Promise<EntrantCandidate | null> {
    const eligibility = await eligibilityOf(organisationId, activityId);
    const clause = scopeClause(scopeFor(eligibility), organisationId, today);

    const result = await db.query(
      `SELECT m.id, m.first_name, m.last_name, m.membership_number,
              m.organisation_id,
              mt.name AS membership_type_name,
              o.display_name AS organisation_name,
              EXISTS (
                SELECT 1 FROM event_entries ee
                 WHERE ee.event_activity_id = $${clause.params.length + 1}
                   AND ee.member_id = m.id
              ) AS already_entered
         FROM members m
         JOIN membership_types mt ON mt.id = m.membership_type_id
         JOIN organizations o ON o.id = m.organisation_id
        WHERE ${clause.sql}
          AND m.id = $${clause.params.length + 2}
        LIMIT 1`,
      [...clause.params, activityId, memberId]
    );

    if (result.rows.length === 0) return null;
    return this.toCandidate(result.rows[0], organisationId);
  }

  private toCandidate(row: any, organisationId: string): EntrantCandidate {
    return {
      memberId: row.id,
      name: [row.first_name, row.last_name].filter(Boolean).join(' '),
      membershipTypeName: row.membership_type_name,
      membershipNumber: row.membership_number,
      organisationName:
        row.organisation_id === organisationId ? null : row.organisation_name,
      alreadyEntered: row.already_entered === true,
    };
  }
}

export const entrantService = new EntrantService();
