/**
 * Memberships Create/Edit Discount Page
 * 
 * Wrapper component that renders the CreateDiscountPage from the events module
 * with moduleType set to 'memberships' for proper context and API calls.
 */

import React from 'react';
import { CreateDiscountPage as EventsCreateDiscountPage } from '@aws-web-framework/orgadmin-events';

const CreateDiscountPage: React.FC = () => {
  // Pass moduleType='memberships' to the events create discount page
  // This ensures discounts are created with the correct module type
  return <EventsCreateDiscountPage moduleType="memberships" />;
};

export default CreateDiscountPage;
