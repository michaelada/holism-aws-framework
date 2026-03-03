/**
 * useDiscountService Hook
 * 
 * Provides the discount service with automatic authentication token injection.
 * This hook ensures the discount service has access to the current user's auth token.
 */

import { useContext, useEffect } from 'react';
import { AuthTokenContext } from '@aws-web-framework/orgadmin-core';
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

  useEffect(() => {
    if (getToken) {
      discountService.setTokenProvider(getToken);
    }
  }, [getToken]);

  return discountService;
}
