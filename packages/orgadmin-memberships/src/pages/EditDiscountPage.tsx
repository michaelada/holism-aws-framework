/**
 * Memberships Edit Discount Page
 * 
 * Wrapper component that renders the CreateDiscountPage from the events module
 * in edit mode with moduleType set to 'memberships'.
 */

import React from 'react';
import { CreateDiscountPage as EventsCreateDiscountPage } from '@aws-web-framework/orgadmin-events';

const EditDiscountPage: React.FC = () => {
  // Pass moduleType='memberships' to the events create discount page
  // The page will detect edit mode from the URL parameter
  return <EventsCreateDiscountPage moduleType="memberships" />;
};

export default EditDiscountPage;
