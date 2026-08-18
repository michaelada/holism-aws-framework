/**
 * A note that the basket changed, for anything that shows how full it is.
 *
 * The count sits in the navigation, and the things that change it are scattered
 * — a slot added from the calendar, a size from the shop, an entry from a form,
 * a line removed on the basket page itself. Threading a refresh callback
 * through every one of those means a new screen that adds to the basket
 * silently fails to update the badge, and nothing points at why.
 *
 * So the notification is raised where every one of them already passes:
 * `useAccountApi`, which fires this after any successful write to a cart URL.
 * A page needs to know nothing about the badge, and a page added later gets it
 * without being told.
 *
 * Deliberately not React state or a context of its own. Subscribers come and go
 * with the shell, and a module-level set is the whole of what is needed —
 * putting it in a provider would mean every screen re-rendering whenever
 * anything anywhere touched the basket.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Subscribe; the returned function unsubscribes. */
export function onCartChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tell every listener the basket may now hold something different. */
export function notifyCartChanged(): void {
  // Copied before iterating: a listener that unsubscribes as it runs would
  // otherwise mutate the set mid-loop.
  for (const listener of [...listeners]) listener();
}

/**
 * A payment that has settled has taken its basket with it.
 *
 * The basket is emptied **server-side, after the request that started
 * checkout has already returned** — the card is confirmed with Stripe by the
 * browser, and the cart only becomes `ordered` once the webhook lands. So the
 * write that `useAccountApi` notices is the one that happens *before* the
 * basket empties, and the only thing the client afterwards is a poll of the
 * payment's status, which is a read.
 *
 * That is the whole reason the badge could outlive the basket. The settlement
 * itself is the event worth announcing, so the two screens that watch a
 * payment resolve say so here.
 *
 * Any status but `pending` counts. A paid or offline-settled basket is closed;
 * a failed one is still open but has had its holds shortened, so the count is
 * worth re-reading either way.
 */
export function notifyIfSettled(status: string | null | undefined): void {
  if (status && status !== 'pending') notifyCartChanged();
}

/**
 * Whether a request was a write to the basket.
 *
 * Matched on the path rather than on a flag the caller passes, for the same
 * reason the notification lives in `useAccountApi` at all: a caller that has to
 * remember is a caller that will forget.
 *
 * Reads are excluded — the count is refreshed *by* a read, and treating that as
 * a change would have it fetch itself for ever.
 */
export function isCartMutation(url: string, method: string): boolean {
  if (method === 'GET') return false;
  return /\/account\/[^/]+\/(cart|checkout)(\/|$)/.test(url);
}
