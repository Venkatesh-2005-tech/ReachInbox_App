export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface EmailAttachment {
  id: string;
  emailId: string;
  filename: string;
  contentType: string;
  size: number;
  path: string;
  createdAt: string;
}

export interface Email {
  id: string;
  userId: string;
  senderId: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  bullJobId: string | null;
  idempotencyKey: string;
  messageId: string | null;
  attempts: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  sender?: { email: string };
  attachments?: EmailAttachment[];
}

export interface ScheduleEmailPayload {
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface ScheduleEmailResponse {
  scheduledCount: number;
  invalidCount: number;
  emails: Email[];
}

export interface Sender {
  id: string;
  email: string;
  createdAt: string;
}
