import React from 'react';
import { CreateDiscountPage as EventsCreateDiscountPage } from '@aws-web-framework/orgadmin-events';

const EditDiscountPage: React.FC = () => {
  return <EventsCreateDiscountPage moduleType="merchandise" />;
};

export default EditDiscountPage;
