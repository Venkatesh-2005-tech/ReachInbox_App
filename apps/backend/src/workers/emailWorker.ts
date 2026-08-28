import { Worker, Job } from 'bullmq';
import { EmailStatus } from '@prisma/client';
import fs from 'fs/promises';

import { redisConnection } from '../config/redis';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { sendEmail } from '../services/emailService';
import {
  checkAndIncrementRateLimit,
  msUntilNextHour,
} from '../services/rateLimitService';
import { updateEmailStatus } from '../services/elasticsearchService';
import { sendSlackNotification } from '../services/slackService';
import { emailQueue } from '../queues/emailQueue';
import { logger } from '../utils/logger';
import { EmailJobData } from '../types';

async function processEmailJob(
  job: Job<EmailJobData>,
): Promise<void> {
  const { emailId, senderId, userId } = job.data;

  logger.info(
    `Processing email job ${job.id} for emailId=${emailId}`,
  );

  /*
   * 1. Load email and its attachments.
   */
  const email = await prisma.email.findUnique({
    where: {
      id: emailId,
    },
    include: {
      sender: true,
      attachments: true,
    },
  });

  if (!email) {
    logger.warn(
      `Email ${emailId} not found in DB — skipping`,
    );
    return;
  }

  /*
   * 2. Idempotency guard.
   */
  if (email.status === EmailStatus.SENT) {
    logger.info(
      `Email ${emailId} already SENT — skipping`,
    );
    return;
  }

  if (email.status === EmailStatus.FAILED) {
    logger.warn(
      `Email ${emailId} is FAILED — skipping`,
    );
    return;
  }

  /*
   * 3. Atomically transition
   * SCHEDULED → PROCESSING.
   */
  const updated = await prisma.email.updateMany({
    where: {
      id: emailId,
      status: EmailStatus.SCHEDULED,
    },
    data: {
      status: EmailStatus.PROCESSING,
    },
  });

  if (updated.count === 0) {
    logger.warn(
      `Email ${emailId} status transition failed — skipping`,
    );
    return;
  }

  await updateEmailStatus(
    emailId,
    EmailStatus.PROCESSING,
  );

  try {
    /*
     * 4. Check hourly rate limit.
     */
    const allowed =
      await checkAndIncrementRateLimit(
        senderId,
      );

    if (!allowed) {
      const delayMs =
        msUntilNextHour() + 1000;

      logger.warn(
        `Rate limit reached for sender ${senderId}. ` +
        `Rescheduling email ${emailId} in ` +
        `${Math.round(delayMs / 60000)}m`,
      );

      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: EmailStatus.SCHEDULED,
        },
      });

      await updateEmailStatus(
        emailId,
        EmailStatus.SCHEDULED,
      );

      /*
       * Slack notification should not prevent
       * the email from being rescheduled.
       */
      try {
        await sendSlackNotification(
          userId,
          `⚠️ Email rate limit reached for sender \`${email.sender.email}\`. Emails have been rescheduled for the next available hour.`,
        );
      } catch (slackError) {
        logger.warn(
          `Slack notification failed: ${
            slackError instanceof Error
              ? slackError.message
              : String(slackError)
          }`,
        );
      }

      /*
       * IMPORTANT:
       * BullMQ v5 custom job IDs must not contain ':'.
       */
      await emailQueue.add(
        'send-email',
        {
          emailId,
          senderId,
          userId,
        },
        {
          delay: delayMs,
          jobId: `reschedule_${emailId}_${Date.now()}`,
        },
      );

      return;
    }

    /*
     * 5. Enforce minimum send delay.
     */
    await sleep(
      env.MIN_EMAIL_DELAY_MS,
    );

    /*
     * 6. Prepare attachments.
     *
     * The actual files are stored on disk.
     * PostgreSQL stores their paths.
     *
     * FIX 5 — verify each file exists on disk before handing its path to
     * nodemailer.  If a file is missing (server restart, different instance,
     * manual deletion) we skip it and log a warning rather than letting
     * nodemailer throw an ENOENT that fails the entire job.
     */
    const attachments: { filename: string; path: string; contentType: string }[] = [];

    for (const attachment of email.attachments) {
      try {
        await fs.access(attachment.path);
        attachments.push({
          filename:    attachment.filename,
          path:        attachment.path,
          contentType: attachment.contentType,
        });
      } catch {
        logger.warn(
          `[Worker] Attachment file not found on disk, skipping: ` +
          `emailId=${emailId} filename=${attachment.filename} ` +
          `path=${attachment.path}`,
        );
      }
    }

    /*
     * 7. Send email.
     */
    const messageId =
      await sendEmail({
        from: email.sender.email,
        to: email.recipient,
        subject: email.subject,
        body: email.body,
        attachments,
      });

    /*
     * 8. Mark email as SENT.
     */
    await prisma.email.update({
      where: {
        id: emailId,
      },
      data: {
        status: EmailStatus.SENT,
        sentAt: new Date(),
        messageId,
        errorMessage: null,
      },
    });

    await updateEmailStatus(
      emailId,
      EmailStatus.SENT,
      new Date(),
      null,
    );

    logger.info(
      `✅ Email ${emailId} sent successfully to ${email.recipient}`,
    );

    if (attachments.length > 0) {
      logger.info(
        `📎 Email ${emailId} sent with ${attachments.length} attachment(s)`,
      );
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error
        ? err.message
        : String(err);

    logger.error(
      `Failed to send email ${emailId}: ${errorMessage}`,
    );

    /*
     * Increment attempts.
     *
     * Keep status SCHEDULED so BullMQ can retry.
     */
    const failedEmail =
      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: EmailStatus.SCHEDULED,
          attempts: {
            increment: 1,
          },
          errorMessage,
        },
      });

    await updateEmailStatus(
      emailId,
      EmailStatus.SCHEDULED,
    );

    /*
     * Permanently fail after 5 attempts.
     */
    if (failedEmail.attempts >= 5) {
      await prisma.email.update({
        where: {
          id: emailId,
        },
        data: {
          status: EmailStatus.FAILED,
        },
      });

      await updateEmailStatus(
        emailId,
        EmailStatus.FAILED,
        null,
        errorMessage,
      );

      logger.error(
        `❌ Email ${emailId} permanently failed after 5 attempts`,
      );
    }

    /*
     * Let BullMQ perform its retry.
     */
    throw err;
  }
}

function sleep(
  ms: number,
): Promise<void> {
  return new Promise(
    (resolve) =>
      setTimeout(resolve, ms),
  );
}

export function startEmailWorker():
  Worker<EmailJobData> {
  const worker =
    new Worker<EmailJobData>(
      'email-queue',
      processEmailJob,
      {
        connection:
          redisConnection,
        concurrency:
          env.WORKER_CONCURRENCY,
      },
    );

  worker.on(
    'completed',
    (job) => {
      logger.info(
        `Job ${job.id} completed`,
      );
    },
  );

  worker.on(
    'failed',
    (job, err) => {
      logger.error(
        `Job ${job?.id} failed: ${err.message}`,
      );
    },
  );

  worker.on(
    'error',
    (err) => {
      logger.error(
        `Worker error: ${err.message}`,
      );
    },
  );

  logger.info(
    `✅ Email worker started (concurrency=${env.WORKER_CONCURRENCY})`,
  );

  return worker;
}