/**
 * Registrations Create/Edit Discount Page
 *
 * Wrapper component that renders the CreateDiscountPage from the events module
 * with moduleType set to 'registrations' for proper context and API calls.
 */

import React from 'react';
import { CreateDiscountPage as EventsCreateDiscountPage } from '@aws-web-framework/orgadmin-events';

const CreateDiscountPage: React.FC = () => {
  return <EventsCreateDiscountPage moduleType="registrations" />;
};

export default CreateDiscountPage;
