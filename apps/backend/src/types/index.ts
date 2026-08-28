import { User } from '@prisma/client';

/**
 * Extend Express request user type.
 */
declare global {
  namespace Express {
    interface User
      extends Omit<
        import('@prisma/client').User,
        'createdAt' | 'updatedAt'
      > {
      createdAt: Date;
      updatedAt: Date;
    }
  }
}

/**
 * Request body used when scheduling emails.
 */
export interface ScheduleEmailBody {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

/**
 * Attachment information stored in the database
 * and passed through BullMQ.
 *
 * IMPORTANT:
 * We do NOT put Buffer data into Redis.
 * The actual file is stored on disk.
 */
export interface EmailJobAttachment {
  id?: string;
  filename: string;
  contentType: string;
  size: number;
  path: string;
}

/**
 * Data passed to BullMQ.
 */
export interface EmailJobData {
  emailId: string;
  senderId: string;
  userId: string;
  attachments?: EmailJobAttachment[];
}

/**
 * Pagination query parameters.
 */
export interface PaginationQuery {
  page?: string;
  limit?: string;
}

export type { User };