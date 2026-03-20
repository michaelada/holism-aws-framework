import React from 'react';
import { CreateDiscountPage as EventsCreateDiscountPage } from '@aws-web-framework/orgadmin-events';

const CreateDiscountPage: React.FC = () => {
  return <EventsCreateDiscountPage moduleType="merchandise" />;
};

export default CreateDiscountPage;
