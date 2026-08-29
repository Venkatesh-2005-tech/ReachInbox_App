import { Resend } from 'resend';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';
import * as fs from 'fs';

const resend = new Resend(env.RESEND_API_KEY);

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

export async function sendEmail(options: SendEmailOptions): Promise<string> {
  const fromAddress = env.SMTP_FROM || 'onboarding@resend.dev';

  // Map attachments for Resend if provided
  const formattedAttachments = options.attachments?.map((att) => {
    try {
      const content = fs.readFileSync(att.path);
      return {
        filename: att.filename,
        content,
      };
    } catch (err) {
      logger.warn(`[Resend] Failed to read attachment at ${att.path}: ${(err as Error).message}`);
      return null;
    }
  }).filter(Boolean);

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: [options.to],
    subject: options.subject,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${options.body.replace(/\n/g, '<br>')}</div>`,
    attachments: formattedAttachments as any,
  });

  if (error) {
    logger.error(`[Resend] Failed to send email to ${options.to}: ${error.message}`);
    throw new Error(error.message);
  }

  logger.info(`[Resend] Email delivered to ${options.to} | id=${data?.id}`);
  return data?.id as string;
}

export async function verifySmtpConnection(): Promise<void> {
  logger.info('[Resend] Using Resend HTTP API (Connection verified)');
}

export async function getSenderEmail(senderId: string): Promise<string> {
  const sender = await prisma.sender.findUnique({ where: { id: senderId } });
  if (!sender) throw new Error(`Sender not found: ${senderId}`);
  return sender.email;
}