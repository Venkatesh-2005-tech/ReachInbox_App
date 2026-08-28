import nodemailer, { Transporter } from 'nodemailer';

import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

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

/**
 * Escape HTML special characters.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Convert plain text email body into safe HTML.
 *
 * Supports:
 * - URLs
 * - line breaks
 * - emojis
 */
function bodyToHtml(body: string): string {
  const escaped = escapeHtml(body);

  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    (url) =>
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
  );

  return withLinks.replace(/\n/g, '<br>');
}

/**
 * Create SMTP transporter.
 *
 * Priority:
 * 1. Real SMTP
 * 2. Ethereal
 */
function createTransporter(): {
  transporter: Transporter;
  mode: 'real' | 'ethereal';
} {
  /**
   * Real SMTP
   */
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
    const port = env.SMTP_PORT ?? 587;
    const secure = env.SMTP_SECURE === 'true';

    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    logger.info(
      `[SMTP] Using real SMTP: ${env.SMTP_HOST}:${port}`,
    );

    return {
      transporter,
      mode: 'real',
    };
  }

  /**
   * Ethereal fallback.
   */
  if (
    env.ETHEREAL_HOST &&
    env.ETHEREAL_USER &&
    env.ETHEREAL_PASSWORD
  ) {
    logger.warn(
      '[SMTP] Using Ethereal fake SMTP. Emails will NOT reach real inboxes.',
    );

    const transporter = nodemailer.createTransport({
      host: env.ETHEREAL_HOST,
      port: env.ETHEREAL_PORT ?? 587,
      secure: false,
      auth: {
        user: env.ETHEREAL_USER,
        pass: env.ETHEREAL_PASSWORD,
      },
    });

    return {
      transporter,
      mode: 'ethereal',
    };
  }

  throw new Error(
    'No SMTP transport configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS or Ethereal variables.',
  );
}

/**
 * Send an email.
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<string> {
  const { transporter, mode } = createTransporter();

  const fromAddress =
    mode === 'real' && env.SMTP_FROM
      ? env.SMTP_FROM
      : options.from;

  const info = await transporter.sendMail({
    from: fromAddress,
    to: options.to,
    subject: options.subject,

    text: options.body,

    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        ${bodyToHtml(options.body)}
      </div>
    `,

    replyTo:
      options.from !== fromAddress
        ? options.from
        : undefined,

    attachments: options.attachments?.map((attachment) => ({
      filename: attachment.filename,
      path: attachment.path,
      contentType: attachment.contentType,
    })),
  });

  if (mode === 'real') {
    logger.info(
      `[SMTP] Email delivered to ${options.to} | messageId=${info.messageId}`,
    );
  } else {
    const previewUrl = nodemailer.getTestMessageUrl(info);

    logger.warn(
      `[SMTP] Ethereal email created for ${options.to} | messageId=${info.messageId}`,
    );

    if (previewUrl) {
      logger.info(
        `[SMTP] Ethereal preview URL: ${previewUrl}`,
      );
    }
  }

  return info.messageId as string;
}

/**
 * Verify SMTP connection.
 */
export async function verifySmtpConnection(): Promise<void> {
  try {
    const { transporter, mode } = createTransporter();

    await transporter.verify();

    logger.info(
      `[SMTP] Connection verified successfully (mode: ${mode})`,
    );
  } catch (err) {
    logger.warn(
      `[SMTP] Connection verification failed: ${
        (err as Error).message
      }`,
    );
  }
}

/**
 * Get sender email address from database.
 */
export async function getSenderEmail(
  senderId: string,
): Promise<string> {
  const sender = await prisma.sender.findUnique({
    where: {
      id: senderId,
    },
  });

  if (!sender) {
    throw new Error(
      `Sender not found: ${senderId}`,
    );
  }

  return sender.email;
}