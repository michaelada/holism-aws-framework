/**
 * Calendar Edit Discount Page
 *
 * Wrapper component that renders the CreateDiscountPage from the events module
 * in edit mode with moduleType set to 'calendar'.
 */

import React from 'react';
import { CreateDiscountPage as EventsCreateDiscountPage } from '@aws-web-framework/orgadmin-events';

const EditDiscountPage: React.FC = () => {
  return <EventsCreateDiscountPage moduleType="calendar" />;
};

export default EditDiscountPage;
