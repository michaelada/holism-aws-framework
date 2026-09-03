/**
 * Merchandise Discount Usage Page
 *
 * Wrapper component that renders the DiscountUsagePage from the events module
 * with moduleType set to 'merchandise', the way the discount list and form pages
 * in this package do.
 */

import React from 'react';
import { DiscountUsagePage as EventsDiscountUsagePage } from '@itsplainsailing/orgadmin-events';

const DiscountUsagePage: React.FC = () => <EventsDiscountUsagePage moduleType="merchandise" />;

export default DiscountUsagePage;
