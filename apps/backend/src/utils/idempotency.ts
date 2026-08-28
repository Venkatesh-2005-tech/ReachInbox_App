import crypto from 'crypto';

/**
 * Generate a deterministic idempotency key for an email.
 * Same inputs always produce the same key, preventing duplicate scheduling.
 */
export function generateIdempotencyKey(
  userId: string,
  senderId: string,
  recipient: string,
  subject: string,
  scheduledAt: Date,
): string {
  const payload = `${userId}:${senderId}:${recipient}:${subject}:${scheduledAt.toISOString()}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

/**
 * Generate a deterministic BullMQ job ID to prevent duplicate jobs.
 *
 * BullMQ v5 forbids custom job IDs that contain a colon (:) unless the ID
 * has EXACTLY 3 colon-separated parts (reserved for repeatable jobs).
 * The idempotencyKey is already a 64-char hex SHA-256 string with no colons,
 * so we use it directly — no prefix needed, uniqueness is guaranteed by the hash.
 */
export function generateJobId(idempotencyKey: string): string {
  // idempotencyKey is a 64-char hex string — safe for BullMQ custom job IDs
  return idempotencyKey;
}
