/**
 * Calendar Create/Edit Discount Page
 *
 * Wrapper component that renders the CreateDiscountPage from the events module
 * with moduleType set to 'calendar' for proper context and API calls.
 */

import React from 'react';
import { CreateDiscountPage as EventsCreateDiscountPage } from '@aws-web-framework/orgadmin-events';

const CreateDiscountPage: React.FC = () => {
  return <EventsCreateDiscountPage moduleType="calendar" />;
};

export default CreateDiscountPage;
