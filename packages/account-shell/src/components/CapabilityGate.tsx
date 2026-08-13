import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';

/**
 * Refuses a route the organisation has not enabled.
 *
 * Hiding an item from the menu is presentation, not access control — a member
 * can still type the URL, and the page behind it would then call an endpoint
 * the capability middleware refuses, producing an error where an explanation
 * belongs. Redirecting to the organisation home is the honest answer: the area
 * does not exist for this club.
 *
 * Shows nothing while the organisation is still resolving, so a member is not
 * bounced off a page they are entitled to merely because capabilities had not
 * arrived yet.
 */
export const CapabilityGate: React.FC<{
  /** Any one of these is enough, matching the menu's any-of rule. */
  anyOf: string[];
  children: React.ReactNode;
}> = ({ anyOf, children }) => {
  const { orgCode } = useParams<{ orgCode: string }>();
  const { state, hasCapability } = useAccountOrganisation();

  if (state === 'loading') return null;

  if (!anyOf.some(hasCapability)) {
    return <Navigate to={`/${orgCode}`} replace />;
  }

  return <>{children}</>;
};

export default CapabilityGate;
