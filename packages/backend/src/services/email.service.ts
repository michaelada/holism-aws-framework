import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../config/logger';

const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-west-1' });

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@eskersoft.com';
const ORGADMIN_URL = process.env.ORGADMIN_URL || 'http://localhost:5175/orgadmin';
const ACCOUNT_URL = process.env.ACCOUNT_URL || 'http://localhost:5176/account';
const LOGO_URL = 'https://itsplainsailing.com/admin/logos/ips-logo-sails-darker-text-transparent-128.png';

interface InviteEmailParams {
  toEmail: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  temporaryPassword: string;
  loginUrl?: string;
}

interface ResendInviteEmailParams {
  toEmail: string;
  firstName: string;
  organizationName: string;
  temporaryPassword: string;
  loginUrl?: string;
}

function buildEmailShell(headerText: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; color: #1E293B; background: #FAF8F5;">
  <div style="background: linear-gradient(135deg, #FF9800 0%, #E65100 100%); height: 6px;"></div>
  <div style="background: #ffffff; padding: 28px 24px; text-align: center; border-bottom: 1px solid #F1EDE8;">
    <img src="${LOGO_URL}" alt="ItsPlainSailing" style="height: 56px; margin-bottom: 12px;" />
    <h1 style="color: #1A1E2E; margin: 0; font-size: 20px; font-weight: 600;">${headerText}</h1>
  </div>
  <div style="background: #ffffff; padding: 32px 24px;">
    ${bodyContent}
  </div>
  <div style="text-align: center; padding: 16px 24px; font-size: 12px; color: #64748B; background: #FAF8F5;">
    Powered by <span style="color: #E65100; font-weight: 600;">ItsPlainSailing</span>
  </div>
</body>
</html>`;
}

function buildButton(label: string, url: string): string {
  return `<div style="text-align: center; margin: 28px 0;">
      <a href="${url}" style="background: linear-gradient(135deg, #FF9800 0%, #E65100 100%); color: #fff; padding: 14px 36px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; font-size: 15px;">${label}</a>
    </div>`;
}

function buildCredentialsBlock(email: string, password: string): string {
  return `<div style="background: #FAF8F5; border: 1px solid #F1EDE8; padding: 16px 20px; border-radius: 6px; margin: 20px 0;">
      <p style="margin: 4px 0; font-size: 14px;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 4px 0; font-size: 14px;"><strong>Temporary Password:</strong> ${password}</p>
    </div>`;
}

/**
 * Send an admin user invitation email via AWS SES
 */
export async function sendAdminInviteEmail(params: InviteEmailParams): Promise<void> {
  const {
    toEmail,
    firstName,
    organizationName,
    temporaryPassword,
    loginUrl = ORGADMIN_URL,
  } = params;

  const subject = `You've been invited to ${organizationName}`;

  const body = `
    <p style="font-size: 15px;">Hi ${firstName},</p>
    <p style="font-size: 15px;">You have been invited as an administrator for <strong>${organizationName}</strong>.</p>
    <p style="font-size: 15px;">Use the credentials below to sign in for the first time. You will be asked to change your password on first login.</p>
    ${buildCredentialsBlock(toEmail, temporaryPassword)}
    ${buildButton('Sign In', loginUrl)}
    <p style="font-size: 12px; color: #64748B;">If you did not expect this invitation, you can safely ignore this email.</p>`;

  const htmlBody = buildEmailShell(`Welcome to ${organizationName}`, body);

  const textBody = `Hi ${firstName},

You have been invited as an administrator for ${organizationName}.

Sign in at: ${loginUrl}
Email: ${toEmail}
Temporary Password: ${temporaryPassword}

You will be asked to change your password on first login.`;

  try {
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    }));
    logger.info('Invitation email sent', { toEmail });
  } catch (error) {
    logger.error('Failed to send invitation email', {
      toEmail,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}


/**
 * Send a reminder/resend invitation email via AWS SES
 */
export async function sendResendInviteEmail(params: ResendInviteEmailParams): Promise<void> {
  const {
    toEmail,
    firstName,
    organizationName,
    temporaryPassword,
    loginUrl = ORGADMIN_URL,
  } = params;

  const subject = `Reminder: You've been invited to ${organizationName}`;

  const body = `
    <p style="font-size: 15px;">Hi ${firstName},</p>
    <p style="font-size: 15px;">This is a friendly reminder that you have been invited as an administrator for <strong>${organizationName}</strong>. Your account is still waiting to be activated.</p>
    <p style="font-size: 15px;">A new temporary password has been generated for you. Use the credentials below to sign in. You will be asked to set a new password on first login.</p>
    ${buildCredentialsBlock(toEmail, temporaryPassword)}
    ${buildButton('Activate Your Account', loginUrl)}
    <p style="font-size: 12px; color: #64748B;">If you did not expect this invitation, you can safely ignore this email.</p>`;

  const htmlBody = buildEmailShell(`Reminder: ${organizationName}`, body);

  const textBody = `Hi ${firstName},

This is a reminder that you have been invited as an administrator for ${organizationName}. Your account is still waiting to be activated.

A new temporary password has been generated for you:

Sign in at: ${loginUrl}
Email: ${toEmail}
Temporary Password: ${temporaryPassword}

You will be asked to set a new password on first login.`;

  try {
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    }));
    logger.info('Resend invitation email sent', { toEmail });
  } catch (error) {
    logger.error('Failed to send resend invitation email', {
      toEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}


// ---------------------------------------------------------------------------
// Account-user registration
//
// Sent when a member registers with an organisation, and when an administrator
// decides on a registration that needed approval. See G6 in
// docs/ACCOUNT_USER_APP_WIREFRAMES.md.
//
// Every one of these follows the same rule as the invitation emails above:
// a delivery failure is logged and swallowed. A member must not be left
// un-registered or un-approved because SES was unavailable — the state in the
// database is the source of truth, and the email is a notification about it.
// ---------------------------------------------------------------------------

interface RegistrationEmailParams {
  toEmail: string;
  firstName: string;
  organizationName: string;
  /** The organisation's short code, so links land on the right portal. */
  urlCode: string;
}

interface RegistrationNotificationParams {
  toEmails: string[];
  organizationName: string;
  applicantName: string;
  applicantEmail: string;
  pendingCount: number;
}

function accountUrl(urlCode: string): string {
  return `${ACCOUNT_URL}/${urlCode}`;
}

async function send(
  toAddresses: string[],
  subject: string,
  htmlBody: string,
  textBody: string,
  description: string
): Promise<void> {
  if (toAddresses.length === 0) return;

  try {
    await ses.send(new SendEmailCommand({
      Source: FROM_EMAIL,
      Destination: { ToAddresses: toAddresses },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    }));
    logger.info(`${description} sent`, { to: toAddresses });
  } catch (error) {
    logger.error(`Failed to send ${description}`, {
      to: toAddresses,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** A member registered and is active immediately (auto-registration on). */
export async function sendRegistrationWelcomeEmail(
  params: RegistrationEmailParams
): Promise<void> {
  const { toEmail, firstName, organizationName, urlCode } = params;
  const url = accountUrl(urlCode);

  const body = `
    <p style="font-size: 15px;">Hi ${firstName},</p>
    <p style="font-size: 15px;">You're now registered with <strong>${organizationName}</strong>.</p>
    <p style="font-size: 15px;">You can sign in any time to see your memberships, entries and bookings, and to make new ones.</p>
    ${buildButton('Go to the member portal', url)}
    <p style="font-size: 12px; color: #64748B;">If you did not register with ${organizationName}, please let them know.</p>`;

  await send(
    [toEmail],
    `You're registered with ${organizationName}`,
    buildEmailShell(`Welcome to ${organizationName}`, body),
    `Hi ${firstName},\n\nYou're now registered with ${organizationName}.\n\nSign in at: ${url}`,
    'registration welcome email'
  );
}

/** A member registered but an administrator has to approve them first. */
export async function sendRegistrationPendingEmail(
  params: RegistrationEmailParams
): Promise<void> {
  const { toEmail, firstName, organizationName, urlCode } = params;
  const url = accountUrl(urlCode);

  const body = `
    <p style="font-size: 15px;">Hi ${firstName},</p>
    <p style="font-size: 15px;">Thanks for registering with <strong>${organizationName}</strong>.</p>
    <p style="font-size: 15px;">Your account is set up, but ${organizationName} reviews new registrations before granting access. We'll email you as soon as you're approved — there's nothing else you need to do.</p>
    ${buildButton('Check your status', url)}`;

  await send(
    [toEmail],
    `Your registration with ${organizationName} is being reviewed`,
    buildEmailShell('Waiting for approval', body),
    `Hi ${firstName},\n\nThanks for registering with ${organizationName}. A club administrator will review your registration and we'll email you once you're approved.\n\n${url}`,
    'registration pending email'
  );
}

/** An administrator approved a registration that was waiting. */
export async function sendRegistrationApprovedEmail(
  params: RegistrationEmailParams
): Promise<void> {
  const { toEmail, firstName, organizationName, urlCode } = params;
  const url = accountUrl(urlCode);

  const body = `
    <p style="font-size: 15px;">Hi ${firstName},</p>
    <p style="font-size: 15px;">Good news — <strong>${organizationName}</strong> has approved your registration.</p>
    <p style="font-size: 15px;">You can now sign in and get started.</p>
    ${buildButton('Sign in', url)}`;

  await send(
    [toEmail],
    `You've been approved by ${organizationName}`,
    buildEmailShell(`Welcome to ${organizationName}`, body),
    `Hi ${firstName},\n\n${organizationName} has approved your registration. Sign in at: ${url}`,
    'registration approved email'
  );
}

/**
 * An administrator declined a registration.
 *
 * Deliberately gives no reason. Whatever the administrator recorded is an
 * internal note, and surfacing it invites arguments the platform cannot
 * adjudicate — the member is pointed at the club instead.
 */
export async function sendRegistrationRejectedEmail(
  params: RegistrationEmailParams & { contactEmail?: string }
): Promise<void> {
  const { toEmail, firstName, organizationName, contactEmail } = params;

  const contactLine = contactEmail
    ? `<p style="font-size: 15px;">If you think this is a mistake, please contact <a href="mailto:${contactEmail}">${contactEmail}</a>.</p>`
    : `<p style="font-size: 15px;">If you think this is a mistake, please contact the club directly.</p>`;

  const body = `
    <p style="font-size: 15px;">Hi ${firstName},</p>
    <p style="font-size: 15px;"><strong>${organizationName}</strong> wasn't able to approve your registration.</p>
    ${contactLine}`;

  await send(
    [toEmail],
    `Your registration with ${organizationName}`,
    buildEmailShell('Registration not approved', body),
    `Hi ${firstName},\n\n${organizationName} wasn't able to approve your registration. If you think this is a mistake, please contact the club${contactEmail ? ` at ${contactEmail}` : ''}.`,
    'registration rejected email'
  );
}

/** Tell the organisation's nominated addresses that someone is waiting. */
export async function sendNewRegistrationNotification(
  params: RegistrationNotificationParams
): Promise<void> {
  const { toEmails, organizationName, applicantName, applicantEmail, pendingCount } = params;

  const body = `
    <p style="font-size: 15px;"><strong>${applicantName}</strong> (${applicantEmail}) has registered with <strong>${organizationName}</strong> and is waiting for approval.</p>
    <p style="font-size: 15px;">${pendingCount} registration${pendingCount === 1 ? '' : 's'} currently waiting.</p>
    ${buildButton('Review registrations', `${ORGADMIN_URL}/users/accounts/pending`)}`;

  await send(
    toEmails,
    `New registration awaiting approval — ${organizationName}`,
    buildEmailShell('A registration needs your approval', body),
    `${applicantName} (${applicantEmail}) has registered with ${organizationName} and is waiting for approval. ${pendingCount} waiting in total.`,
    'new registration notification'
  );
}
