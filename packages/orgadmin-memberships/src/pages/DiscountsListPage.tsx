/**
 * Memberships Discounts List Page
 * 
 * Wrapper component that renders the DiscountsListPage from the events module
 * with moduleType set to 'memberships' for proper filtering and context.
 */

import React from 'react';
import { DiscountsListPage as EventsDiscountsListPage } from '@aws-web-framework/orgadmin-events';

const DiscountsListPage: React.FC = () => {
  // Pass moduleType='memberships' to the events discount list page
  // This ensures discounts are filtered by the memberships module
  return <EventsDiscountsListPage moduleType="memberships" />;
};

export default DiscountsListPage;
