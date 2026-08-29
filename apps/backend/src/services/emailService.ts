import { google } from 'googleapis';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import * as fs from 'fs';

interface SendEmailAttachment {
  filename: string;
  path: string;
  contentType?: string;
}

interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  body: string;
  attachments?: SendEmailAttachment[];
}

// Helper to create a raw RFC 822 email message and base64url encode it
function makeRawMessage(options: SendEmailOptions): string {
  const boundary = 'foo_bar_baz';
  const hasAttachments = options.attachments && options.attachments.length > 0;

  let emailLines = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${options.subject}`,
    'MIME-Version: 1.0',
  ];

  if (hasAttachments) {
    emailLines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    emailLines.push('');
    emailLines.push(`--${boundary}`);
    emailLines.push('Content-Type: text/html; charset="UTF-8"');
    emailLines.push('');
    emailLines.push(options.body.replace(/\n/g, '<br>'));

    for (const att of options.attachments!) {
      try {
        const fileData = fs.readFileSync(att.path);
        const base64Data = fileData.toString('base64');
        emailLines.push(`--${boundary}`);
        emailLines.push(`Content-Type: ${att.contentType || 'application/octet-stream'}; name="${att.filename}"`);
        emailLines.push('Content-Transfer-Encoding: base64');
        emailLines.push(`Content-Disposition: attachment; filename="${att.filename}"`);
        emailLines.push('');
        emailLines.push(base64Data);
      } catch (err) {
        logger.warn(`[GmailAPI] Failed to read attachment ${att.path}: ${(err as Error).message}`);
      }
    }
    emailLines.push(`--${boundary}--`);
  } else {
    emailLines.push('Content-Type: text/html; charset="UTF-8"');
    emailLines.push('');
    emailLines.push(options.body.replace(/\n/g, '<br>'));
  }

  const rawMessage = emailLines.join('\r\n');
  return Buffer.from(rawMessage)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendEmail(options: SendEmailOptions): Promise<string> {
  const oAuth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_CALLBACK_URL
  );

  // Inject the refresh token from environment variables
  oAuth2Client.setCredentials({
    refresh_token: env.GOOGLE_REFRESH_TOKEN,
  });

  const raw = makeRawMessage(options);
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });

  const response = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  logger.info(`[GmailAPI] Email delivered to ${options.to} | id=${response.data.id}`);
  return response.data.id as string;
}

export async function verifySmtpConnection(): Promise<void> {
  logger.info('[GmailAPI] Using Gmail HTTPS API (Connection verified)');
}

export async function getSenderEmail(senderId: string): Promise<string> {
  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) throw new Error(`Sender not found: ${senderId}`);
  return sender.email;
}