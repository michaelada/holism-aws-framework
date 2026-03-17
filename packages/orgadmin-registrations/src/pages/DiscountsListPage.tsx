/**
 * Registrations Discounts List Page
 *
 * Wrapper component that renders the DiscountsListPage from the events module
 * with moduleType set to 'registrations' for proper filtering and context.
 */

import React from 'react';
import { DiscountsListPage as EventsDiscountsListPage } from '@aws-web-framework/orgadmin-events';

const DiscountsListPage: React.FC = () => {
  return <EventsDiscountsListPage moduleType="registrations" />;
};

export default DiscountsListPage;
