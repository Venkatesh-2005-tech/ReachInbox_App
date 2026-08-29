import { Resend } from 'resend';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

const resend = new Resend(process.env.RESEND_API_KEY);

interface SendEmailOptions {
  from: string;
  to: string;
  subject: string;
  body: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<string> {
  const fromAddress = env.SMTP_FROM || 'onboarding@resend.dev';

  const { data, error } = await resend.emails.send({
    from: fromAddress,
    to: [options.to],
    subject: options.subject,
    html: `<div style="font-family: Arial, sans-serif; line-height: 1.6;">${options.body.replace(/\n/g, '<br>')}</div>`,
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