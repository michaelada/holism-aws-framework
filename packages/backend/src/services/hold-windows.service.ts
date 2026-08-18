import { db } from '../database/pool';
import { logger } from '../config/logger';
import { DEFAULT_HOLD_WINDOWS, HoldWindows, holdWindowsFrom } from '../utils/holds';

/**
 * How long a club holds things for.
 *
 * Stored in `organizations.settings.holds` and set by the super-admin, because
 * the right window is a property of the club rather than of the platform: a
 * riding school taking bookings all day wants a short basket hold so slots come
 * back quickly, and a club selling a handful of event entries a season does not
 * care. Both were previously stuck with the platform's two minutes.
 *
 * Read on every add-to-basket and every checkout, so it is cached briefly. The
 * value changes when a super-admin edits it — perhaps twice in the life of an
 * organisation — and re-reading it per request is a query per basket line to
 * answer a question whose answer is nearly always the same.
 */

/** Long enough to be worth having, short enough that an edit takes effect. */
const CACHE_MS = 30_000;

interface Cached {
  windows: HoldWindows;
  readAt: number;
}

export class HoldWindowsService {
  private readonly cache = new Map<string, Cached>();

  async forOrganisation(organisationId: string, now: Date = new Date()): Promise<HoldWindows> {
    const cached = this.cache.get(organisationId);
    if (cached && now.getTime() - cached.readAt < CACHE_MS) {
      return cached.windows;
    }

    try {
      const result = await db.query('SELECT settings FROM organizations WHERE id = $1', [
        organisationId,
      ]);

      const windows = holdWindowsFrom(result.rows[0]?.settings);
      this.cache.set(organisationId, { windows, readAt: now.getTime() });
      return windows;
    } catch (error) {
      /*
       * The platform's defaults, not a failure. This is asked while a member is
       * adding something to a basket; refusing that because a settings read
       * blipped would be a far worse outcome than a hold of the standard
       * length.
       */
      logger.error('Could not read hold windows; using the platform defaults', {
        organisationId,
        error: error instanceof Error ? error.message : String(error),
      });
      return { ...DEFAULT_HOLD_WINDOWS };
    }
  }

  /** Drop a club's cached windows, so an edit takes effect at once. */
  forget(organisationId: string): void {
    this.cache.delete(organisationId);
  }

  /** Testing seam, and used when an organisation is deleted. */
  clear(): void {
    this.cache.clear();
  }
}

export const holdWindowsService = new HoldWindowsService();
