import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../config/logger';

const ses = new SESClient({ region: process.env.AWS_REGION || 'eu-west-1' });

const FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@eskersoft.com';
const ORGADMIN_URL = process.env.ORGADMIN_URL || 'http://localhost:5175/orgadmin';
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
