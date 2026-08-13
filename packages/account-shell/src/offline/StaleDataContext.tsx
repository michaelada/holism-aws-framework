import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Whether anything on the screen the member is looking at came from the cache,
 * and how old it is.
 *
 * **The rule this exists for**: a cached screen must say so. Stale data
 * presented as current is worse than no data — a member reading a three-hour-old
 * entry list as live will turn up to an event that filled, or think a payment
 * has not gone through. Once the offline banner is collapsed to a chip, nothing
 * else on the page distinguishes saved data from fresh.
 *
 * **Tracked centrally rather than per screen.** Offline behaviour already lives
 * in `useAccountApi`; this is the other half of it, and putting the notice in
 * one place means a page added later is honest about its data without doing
 * anything. A screen makes several requests — `EntryFormPage` makes four — so a
 * per-call notice would also have to decide which of them to believe.
 *
 * **Any cached answer marks the screen**, not all of them. If a page shows one
 * fresh list beside one saved one, part of what the member is reading is old,
 * and that is the fact worth stating. The claim is deliberately about the
 * screen ("some of this is saved") rather than about a particular list.
 */

interface StaleDataValue {
  /** When the oldest cached answer on this screen was fetched, if any. */
  staleSince: string | null;
  /** Called by the request layer when it served a cached answer. */
  noteCached: (fetchedAt: string) => void;
}

/**
 * A no-op by default, so the request hook works with no provider above it —
 * in tests, and on the unbranded public screens that render outside the shell.
 */
const StaleDataContext = createContext<StaleDataValue>({
  staleSince: null,
  noteCached: () => undefined,
});

export const StaleDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [staleSince, setStaleSince] = useState<string | null>(null);
  const { pathname } = useLocation();

  /*
   * Cleared on navigation. The claim is about the screen in front of the
   * member, so carrying it to the next one would leave a fresh page wearing a
   * stale label — and the request the new screen is about to make will mark it
   * again within the same tick if it is also cached.
   */
  useEffect(() => {
    setStaleSince(null);
  }, [pathname]);

  const noteCached = useCallback((fetchedAt: string) => {
    // The oldest wins: it is the weakest thing the screen is standing on.
    setStaleSince((current) => (current && current < fetchedAt ? current : fetchedAt));
  }, []);

  const value = useMemo(() => ({ staleSince, noteCached }), [staleSince, noteCached]);

  return <StaleDataContext.Provider value={value}>{children}</StaleDataContext.Provider>;
};

export const useStaleData = (): StaleDataValue => useContext(StaleDataContext);

export default StaleDataProvider;
