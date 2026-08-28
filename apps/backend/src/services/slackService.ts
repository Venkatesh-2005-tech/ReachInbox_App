import https from 'https';
import { prisma } from '../config/prisma';
import { logger } from '../utils/logger';

/**
 * Send a Slack message to a user's connected workspace.
 * Silently no-ops if the user has no Slack connection.
 * Never logs the access token.
 */
export async function sendSlackNotification(userId: string, message: string): Promise<void> {
  try {
    const connection = await prisma.slackConnection.findUnique({ where: { userId } });
    if (!connection) return;

    const payload = JSON.stringify({
      channel: connection.channelId ?? '#general',
      text: message,
    });

    await postToSlack(connection.accessToken, payload);
    logger.info(`Slack notification sent for user ${userId}`);
  } catch (err) {
    // Slack failures must never crash email sending
    logger.warn(`Slack notification failed for user ${userId}: ${(err as Error).message}`);
  }
}

function postToSlack(token: string, payload: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'slack.com',
      path: '/api/chat.postMessage',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data) as { ok: boolean; error?: string };
          if (!parsed.ok) {
            reject(new Error(`Slack API error: ${parsed.error ?? 'unknown'}`));
          } else {
            resolve();
          }
        } catch {
          reject(new Error('Failed to parse Slack response'));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
