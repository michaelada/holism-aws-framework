/**
 * Memberships Discount Usage Page
 *
 * Wrapper component that renders the DiscountUsagePage from the events module
 * with moduleType set to 'memberships', the way the discount list and form pages
 * in this package do.
 */

import React from 'react';
import { DiscountUsagePage as EventsDiscountUsagePage } from '@aws-web-framework/orgadmin-events';

const DiscountUsagePage: React.FC = () => <EventsDiscountUsagePage moduleType="memberships" />;

export default DiscountUsagePage;
