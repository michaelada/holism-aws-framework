import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@mui/material';
import { useAuthContext } from '../context/AuthContext';

/**
 * Who the visitor is currently signed in as.
 *
 * Shown on the two screens a person can reach **as the wrong identity**:
 * not-connected (A6) and awaiting-approval (A8).
 *
 * Keycloak's session is a cookie for the whole realm, shared by every client in
 * it — the org-admin app included. This shell initialises with `check-sso`, so
 * a visitor who already has a session anywhere in the realm arrives here
 * silently authenticated as that person, with no form drawn and nothing said.
 * Opening a club's link in a second tab after signing in to org-admin does
 * exactly that, and the screen that followed talked only about *this club*
 * having no record of them — accurate, and no help at all in working out that
 * the identity was the problem.
 *
 * Naming the identity is most of the fix. The rest is in the buttons beside it:
 * the enrolment action says whose account it would create.
 */
export const SignedInAs: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuthContext();

  if (!user) return null;

  return (
    <Alert severity="info" sx={{ mb: 3 }}>
      {t('common.signedInAs', { name: describeUser(user) })}
    </Alert>
  );
};

/**
 * A person, as a line of text.
 *
 * The email is always included rather than only when the name is missing: two
 * people can share a display name, and it is the email that tells somebody
 * they are signed in as their administrator account rather than themselves.
 */
export const describeUser = (user: {
  email: string;
  firstName?: string;
  lastName?: string;
}): string => {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name ? `${name} (${user.email})` : user.email;
};

export default SignedInAs;
