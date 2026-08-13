/**
 * The last answer the server gave, kept so a member with no signal still has a
 * screen.
 *
 * **Scoped to one person and one club.** The key carries the organisation and
 * the signed-in identity, and everything is cleared on sign-out and on
 * switching away. A club device passed between members must not show the
 * previous one's payment history, and that is a privacy failure rather than a
 * caching bug — it is the reason the clearing rules matter more than the store.
 *
 * **`localStorage`, not IndexedDB.** The design named IndexedDB; what is
 * actually stored is a few dozen small JSON documents — lists of entries,
 * tickets, payments — well inside the 5MB a browser gives localStorage, and
 * synchronous reads mean a cached screen paints in the first render rather than
 * flashing empty. IndexedDB buys volume and transactions this does not need. If
 * cached form definitions or images ever land here, revisit it.
 *
 * **Every entry records when it was fetched.** A screen that cannot say how old
 * its data is has to present it as current, and stale data presented as current
 * is worse than no data at all.
 */

const PREFIX = 'account-cache';

export interface CachedResponse<T = unknown> {
  data: T;
  /** When the server actually answered, as an ISO string. */
  fetchedAt: string;
}

/**
 * Identity of one cached answer.
 *
 * The user id is in the key rather than merely checked on read: two members
 * sharing a device get separate entries, so signing in as the second cannot
 * surface the first's data even for the instant before a clear runs.
 */
const keyFor = (userId: string, url: string): string => `${PREFIX}:${userId}:${url}`;

/** Whether storage is usable at all — private modes and quota refusals happen. */
const storage = (): Storage | null => {
  try {
    const probe = '__account_cache_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
};

/** Keep the last answer to a GET. Failures are silent: a cache is a courtesy. */
export function rememberResponse(userId: string, url: string, data: unknown): void {
  const store = storage();
  if (!store || !userId) return;

  try {
    const entry: CachedResponse = { data, fetchedAt: new Date().toISOString() };
    store.setItem(keyFor(userId, url), JSON.stringify(entry));
  } catch {
    /*
     * Quota exceeded, most likely. Dropping the write is right: the member
     * still has a working online app, and failing their request because the
     * cache is full would turn a courtesy into a fault.
     */
  }
}

export function recallResponse<T>(userId: string, url: string): CachedResponse<T> | null {
  const store = storage();
  if (!store || !userId) return null;

  try {
    const raw = store.getItem(keyFor(userId, url));
    if (!raw) return null;

    const entry = JSON.parse(raw) as CachedResponse<T>;
    // A half-written or hand-edited entry is no entry.
    return entry && typeof entry.fetchedAt === 'string' ? entry : null;
  } catch {
    return null;
  }
}

/**
 * Forget everything cached for this identity — or, with no identity, for
 * everyone.
 *
 * Called on sign-out and on switching organisation. The second is easy to miss:
 * the same person moving between two clubs is still one identity, but the data
 * belongs to the club they have left, and a shared device shows it to whoever
 * looks next.
 */
export function forgetResponses(userId?: string): void {
  const store = storage();
  if (!store) return;

  const prefix = userId ? `${PREFIX}:${userId}:` : `${PREFIX}:`;
  const doomed: string[] = [];

  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index);
    if (key && key.startsWith(prefix)) doomed.push(key);
  }

  // Collected first: removing while iterating shifts the indices under us.
  for (const key of doomed) store.removeItem(key);
}
