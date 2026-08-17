import { useCallback, useEffect, useState } from 'react';
import { useAccountApi } from '../hooks/useAccountApi';
import { onCartChanged } from './cartActivity';
import { CartView } from '../types/account';

/**
 * How many things are in the member's basket, for the badge in the navigation.
 *
 * Counts **lines, not quantities**: three of one jumper is one thing to come
 * back to, and a badge reading "3" for a single item in the basket would be
 * read as three items and send the member to check.
 *
 * Expired lines are left out. A hold that has lapsed is no longer something the
 * member has — checkout refuses the basket while one is present — so counting
 * it would advertise an item they cannot buy.
 *
 * Refetched whenever anything writes to the basket, through `onCartChanged`,
 * rather than polled or refreshed on navigation: a member who adds a slot and
 * stays on the calendar still sees the count move.
 */
export function useCartCount(orgCode: string | null | undefined): number {
  const { execute } = useAccountApi<CartView>();
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!orgCode) {
      setCount(0);
      return;
    }

    try {
      const cart = await execute({ url: `/api/account/${orgCode}/cart` });
      setCount((cart?.items ?? []).filter((item) => !item.expired).length);
    } catch {
      /*
       * Silent. This is decoration on a menu: a member who is offline, or whose
       * session has just lapsed, should not be shown an error about a number
       * they did not ask for. The basket page itself reports properly.
       */
    }
  }, [execute, orgCode]);

  useEffect(() => {
    void refresh();
    return onCartChanged(() => {
      void refresh();
    });
  }, [refresh]);

  return count;
}
