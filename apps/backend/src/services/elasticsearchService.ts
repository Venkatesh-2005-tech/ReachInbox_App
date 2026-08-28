import { esClient, EMAIL_INDEX } from '../config/elasticsearch';
import { logger } from '../utils/logger';
import { Email, EmailStatus } from '@prisma/client';

interface EmailDocument {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  senderId: string;
  userId: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
}

function toDocument(email: Email): EmailDocument {
  return {
    id: email.id,
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    senderId: email.senderId,
    userId: email.userId,
    status: email.status,
    scheduledAt: email.scheduledAt.toISOString(),
    sentAt: email.sentAt?.toISOString() ?? null,
  };
}

/**
 * Index or update a single email document. ES failures do not throw.
 */
export async function indexEmail(email: Email): Promise<void> {
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: email.id,
      document: toDocument(email),
    });
  } catch (err) {
    logger.warn(`ES index failed for email ${email.id}: ${(err as Error).message}`);
  }
}

/**
 * Update just the status fields on an existing document.
 */
export async function updateEmailStatus(
  emailId: string,
  status: EmailStatus,
  sentAt?: Date | null,
  errorMessage?: string | null,
): Promise<void> {
  try {
    await esClient.update({
      index: EMAIL_INDEX,
      id: emailId,
      doc: {
        status,
        sentAt: sentAt?.toISOString() ?? null,
        errorMessage,
      },
    });
  } catch (err) {
    logger.warn(`ES update failed for email ${emailId}: ${(err as Error).message}`);
  }
}

/**
 * Full-text search over recipient, subject, and body.
 */
export async function searchEmails(
  userId: string,
  query: string,
  page = 1,
  limit = 20,
): Promise<{ hits: EmailDocument[]; total: number }> {
  try {
    const from = (page - 1) * limit;
    const result = await esClient.search<EmailDocument>({
      index: EMAIL_INDEX,
      from,
      size: limit,
      query: {
        bool: {
          must: [
            { term: { userId } },
            {
              multi_match: {
                query,
                fields: ['recipient', 'subject', 'body'],
                fuzziness: 'AUTO',
              },
            },
          ],
        },
      },
    });

    const hits = result.hits.hits.map((h) => h._source!);
    const total =
      typeof result.hits.total === 'number'
        ? result.hits.total
        : (result.hits.total?.value ?? 0);

    return { hits, total };
  } catch (err) {
    logger.warn(`ES search failed: ${(err as Error).message}`);
    return { hits: [], total: 0 };
  }
}
