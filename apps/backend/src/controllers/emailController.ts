import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs/promises';

import { prisma } from '../config/prisma';
import { emailQueue } from '../queues/emailQueue';
import { indexEmail, searchEmails } from '../services/elasticsearchService';
import { generateIdempotencyKey, generateJobId } from '../utils/idempotency';
import { parseRecipients } from '../utils/validation';
import { logger } from '../utils/logger';

// ─── Zod schema ──────────────────────────────────────────────────────────────

const scheduleSchema = z.object({
  senderId:           z.string().min(1),
  subject:            z.string().min(1),
  body:               z.string().min(1),
  recipients:         z.array(z.string()).min(1),
  startTime:          z.string().datetime(),
  delayBetweenEmails: z.number().int().min(0).default(2000),
  hourlyLimit:        z.number().int().min(1).max(1000).default(200),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

type MulterFile = Express.Multer.File;

function getMulterFiles(req: Request): MulterFile[] {
  if (!req.files) return [];
  if (Array.isArray(req.files)) return req.files as MulterFile[];
  return [];
}

/**
 * FIX 6 — strip characters that are unsafe in file-system paths.
 * Prevents path-traversal and fs.writeFile errors on special chars.
 */
function sanitizeFilename(name: string): string {
  // Keep alphanumerics, dots, hyphens, underscores; replace everything else.
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
}

// ─── scheduleEmails ──────────────────────────────────────────────────────────

export async function scheduleEmails(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;

    // Multipart sends everything as strings — coerce back to expected types.
    let parsedRecipients: unknown;
    try {
      parsedRecipients =
        typeof req.body.recipients === 'string'
          ? JSON.parse(req.body.recipients)
          : req.body.recipients;
    } catch {
      res.status(400).json({ error: 'Invalid recipients format' });
      return;
    }

    const requestData = {
      senderId:           req.body.senderId,
      subject:            req.body.subject,
      body:               req.body.body,
      recipients:         parsedRecipients,
      startTime:          req.body.startTime,
      delayBetweenEmails:
        req.body.delayBetweenEmails !== undefined
          ? Number(req.body.delayBetweenEmails)
          : 2000,
      hourlyLimit:
        req.body.hourlyLimit !== undefined
          ? Number(req.body.hourlyLimit)
          : 200,
    };

    const parsed = scheduleSchema.safeParse(requestData);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { senderId, subject, body, recipients, startTime, delayBetweenEmails } = parsed.data;

    // Verify sender belongs to this user.
    const sender = await prisma.sender.findFirst({ where: { id: senderId, userId } });
    if (!sender) {
      res.status(404).json({ error: 'Sender not found or not owned by you' });
      return;
    }

    const { valid, invalid } = parseRecipients(recipients);
    if (valid.length === 0) {
      res.status(400).json({ error: 'No valid recipients provided', invalidCount: invalid.length });
      return;
    }

    // ── FIX 4 + FIX 2 + FIX 3 ───────────────────────────────────────────────
    // Write each uploaded file buffer to disk once (before the per-recipient
    // loop), create the upload directory, and collect the on-disk metadata that
    // will be stored in EmailAttachment rows and read back by the worker.
    const uploadDir = path.join(process.cwd(), 'uploads', 'email-attachments');
    await fs.mkdir(uploadDir, { recursive: true });

    const multerFiles = getMulterFiles(req);

    // Validate per-file size (belt-and-suspenders alongside multer's limit).
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    for (const file of multerFiles) {
      if (file.size > MAX_FILE_SIZE) {
        res.status(400).json({
          error: `Attachment "${file.originalname}" exceeds the 10 MB limit.`,
        });
        return;
      }
    }

    // FIX 2 — write buffers to disk; FIX 6 — sanitize filenames.
    type DiskAttachment = {
      filename:    string; // original display name
      contentType: string;
      size:        number;
      diskPath:    string; // absolute path on disk
    };

    const diskAttachments: DiskAttachment[] = [];

    for (const file of multerFiles) {
      // Use a unique prefix so concurrent requests never collide.
      const unique   = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const safeName = sanitizeFilename(file.originalname);
      const diskPath = path.join(uploadDir, `${unique}-${safeName}`);

      await fs.writeFile(diskPath, file.buffer); // FIX 2 — buffer actually written

      diskAttachments.push({
        filename:    file.originalname,
        contentType: file.mimetype || 'application/octet-stream',
        size:        file.size,
        diskPath,
      });
    }

    // ── Per-recipient scheduling ──────────────────────────────────────────────
    const start = new Date(startTime);
    const createdEmails = [];

    for (let i = 0; i < valid.length; i++) {
      const recipient  = valid[i];
      const scheduledAt = new Date(start.getTime() + i * delayBetweenEmails);

      const idempotencyKey = generateIdempotencyKey(userId, senderId, recipient, subject, scheduledAt);
      const jobId          = generateJobId(idempotencyKey);

      // Idempotency — skip if already scheduled.
      let email = await prisma.email.findUnique({ where: { idempotencyKey } });

      if (!email) {
        // Create the Email row first so we have its id for the attachments.
        email = await prisma.email.create({
          data: {
            userId,
            senderId,
            recipient,
            subject,
            body,
            scheduledAt,
            idempotencyKey,
            bullJobId: jobId,
            status: 'SCHEDULED',
          },
        });

        // FIX 3 — create one EmailAttachment row per file per email.
        // The worker reads these rows back and passes paths to nodemailer.
        const savedAttachments = await Promise.all(
          diskAttachments.map((att) =>
            prisma.emailAttachment.create({
              data: {
                emailId:     email!.id,
                filename:    att.filename,
                contentType: att.contentType,
                size:        att.size,
                path:        att.diskPath, // FIX 1 — path is now present
              },
            }),
          ),
        );

        // Index in Elasticsearch; failure must not block scheduling.
        indexEmail(email).catch(() => {});

        const delayFromNow = Math.max(0, scheduledAt.getTime() - Date.now());

        // FIX 1 — EmailJobAttachment now includes the required `path` field.
        await emailQueue.add(
          'send-email',
          {
            emailId:  email.id,
            senderId,
            userId,
            attachments: savedAttachments.map((att) => ({
              id:          att.id,
              filename:    att.filename,
              contentType: att.contentType,
              size:        att.size,
              path:        att.path, // ← previously missing, caused TS error
            })),
          },
          { jobId, delay: delayFromNow },
        );

        logger.info(
          `Scheduled email ${email.id} for ${recipient} at ${scheduledAt.toISOString()} ` +
          `with ${savedAttachments.length} attachment(s)`,
        );
      }

      createdEmails.push(email);
    }

    res.json({
      scheduledCount: createdEmails.length,
      invalidCount:   invalid.length,
      emails:         createdEmails,
    });
  } catch (err) {
    next(err);
  }
}

// ─── getScheduledEmails ───────────────────────────────────────────────────────

export async function getScheduledEmails(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;

    const page  = Math.max(1,   parseInt((req.query.page  as string) ?? '1',  10));
    const limit = Math.min(100, parseInt((req.query.limit as string) ?? '20', 10));
    const skip  = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where:   { userId, status: { in: ['SCHEDULED', 'PROCESSING'] } },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
        include: {
          sender:      { select: { email: true } },
          attachments: true,
        },
      }),
      prisma.email.count({ where: { userId, status: { in: ['SCHEDULED', 'PROCESSING'] } } }),
    ]);

    res.json({ emails, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// ─── getSentEmails ────────────────────────────────────────────────────────────

export async function getSentEmails(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;

    const page  = Math.max(1,   parseInt((req.query.page  as string) ?? '1',  10));
    const limit = Math.min(100, parseInt((req.query.limit as string) ?? '20', 10));
    const skip  = (page - 1) * limit;

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where:   { userId, status: { in: ['SENT', 'FAILED'] } },
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
        include: {
          sender:      { select: { email: true } },
          attachments: true,
        },
      }),
      prisma.email.count({ where: { userId, status: { in: ['SENT', 'FAILED'] } } }),
    ]);

    res.json({ emails, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (err) {
    next(err);
  }
}

// ─── searchEmailsHandler ─────────────────────────────────────────────────────

export async function searchEmailsHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;
    const q      = ((req.query.q as string) ?? '').trim();
    const page   = Math.max(1,   parseInt((req.query.page  as string) ?? '1',  10));
    const limit  = Math.min(100, parseInt((req.query.limit as string) ?? '20', 10));

    if (!q) {
      res.status(400).json({ error: 'Query parameter "q" is required' });
      return;
    }

    const result = await searchEmails(userId, q, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
