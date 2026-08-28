import { Request, Response, NextFunction } from 'express';
import https from 'https';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../utils/logger';

export function connectSlack(req: Request, res: Response): void {
  if (!env.SLACK_CLIENT_ID) {
    res.status(503).json({ error: 'Slack integration not configured' });
    return;
  }

  const userId = (req.user as { id: string }).id;
  const state = Buffer.from(JSON.stringify({ userId })).toString('base64');
  const scopes = 'chat:write,channels:read';

  const url =
    `https://slack.com/oauth/v2/authorize` +
    `?client_id=${encodeURIComponent(env.SLACK_CLIENT_ID)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&redirect_uri=${encodeURIComponent(env.SLACK_REDIRECT_URI)}` +
    `&state=${state}`;

  res.redirect(url);
}

export async function slackCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code, state } = req.query as { code?: string; state?: string };

    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state' });
      return;
    }

    if (!env.SLACK_CLIENT_ID || !env.SLACK_CLIENT_SECRET) {
      res.status(503).json({ error: 'Slack not configured' });
      return;
    }

    const { userId } = JSON.parse(Buffer.from(state, 'base64').toString('utf8')) as { userId: string };

    // Exchange code for access token
    const tokenData = await exchangeSlackCode(code, env.SLACK_CLIENT_ID, env.SLACK_CLIENT_SECRET, env.SLACK_REDIRECT_URI);

    await prisma.slackConnection.upsert({
      where: { userId },
      update: {
        accessToken: tokenData.access_token,
        teamId: tokenData.team?.id ?? null,
        channelId: tokenData.incoming_webhook?.channel_id ?? null,
      },
      create: {
        userId,
        accessToken: tokenData.access_token,
        teamId: tokenData.team?.id ?? null,
        channelId: tokenData.incoming_webhook?.channel_id ?? null,
      },
    });

    logger.info(`Slack connected for user ${userId} (team: ${tokenData.team?.name ?? 'unknown'})`);
    res.redirect(`${env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    next(err);
  }
}

export async function getSlackStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;
    const connection = await prisma.slackConnection.findUnique({
      where: { userId },
      select: { id: true, teamId: true, channelId: true, createdAt: true },
    });
    res.json({ connected: !!connection, connection });
  } catch (err) {
    next(err);
  }
}

export async function disconnectSlack(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;
    await prisma.slackConnection.deleteMany({ where: { userId } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

interface SlackTokenResponse {
  access_token: string;
  team?: { id: string; name: string };
  incoming_webhook?: { channel_id: string };
}

function exchangeSlackCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<SlackTokenResponse> {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }).toString();

    const options = {
      hostname: 'slack.com',
      path: '/api/oauth.v2.access',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(params),
      },
    };

    const reqHttp = https.request(options, (resHttp) => {
      let data = '';
      resHttp.on('data', (chunk) => (data += chunk));
      resHttp.on('end', () => {
        try {
          const parsed = JSON.parse(data) as SlackTokenResponse & { ok: boolean; error?: string };
          if (!parsed.ok) {
            reject(new Error(`Slack OAuth error: ${parsed.error ?? 'unknown'}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error('Failed to parse Slack token response'));
        }
      });
    });

    reqHttp.on('error', reject);
    reqHttp.write(params);
    reqHttp.end();
  });
}
