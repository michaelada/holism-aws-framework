/**
 * useDiscountService Hook
 * 
 * Provides the discount service with automatic authentication token injection.
 * This hook ensures the discount service has access to the current user's auth token.
 */

import { useContext, useEffect } from 'react';
import { AuthTokenContext, useOrganisation } from '@aws-web-framework/orgadmin-core';
import { discountService } from '../services/discount.service';

/**
 * Hook to get the discount service with authentication
 * 
 * @example
 * const discountService = useDiscountService();
 * const discounts = await discountService.getDiscounts({ organisationId: '123' });
 */
export function useDiscountService() {
  const getToken = useContext(AuthTokenContext);
  /*
   * Read without insisting on it.
   *
   * `useOrganisation` throws outside its provider, and plenty of component
   * tests render a page that uses this hook without one. Making those throw to
   * add an id to a URL would be trading a working test suite for a cosmetic
   * improvement — so no provider simply means no scoping, which is exactly how
   * this service behaved before.
   *
   * The hook is still called unconditionally, so the rules of hooks hold.
   */
  let organisation: { id?: string } | null = null;
  try {
    organisation = useOrganisation().organisation;
  } catch {
    organisation = null;
  }

  useEffect(() => {
    if (getToken) {
      discountService.setTokenProvider(getToken);
    }
  }, [getToken]);

  /*
   * The organisation the shell resolved, so this service and `useApi` agree
   * about which club is being worked in. Read from `useOrganisation` rather
   * than the context `useApi` uses, only because this package resolves
   * orgadmin-core through a stale build that predates that export.
   */
  useEffect(() => {
    const id = organisation?.id ?? null;
    discountService.setOrganisationProvider(() => id);
  }, [organisation?.id]);

  return discountService;
}
