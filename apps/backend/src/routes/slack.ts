import { Router } from 'express';
import {
  connectSlack,
  slackCallback,
  getSlackStatus,
  disconnectSlack,
} from '../controllers/slackController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Connect: starts OAuth flow (user must be authenticated)
router.get('/connect', requireAuth, connectSlack);

// Callback: Slack redirects back here (state carries userId)
router.get('/callback', slackCallback);

// Status
router.get('/status', requireAuth, getSlackStatus);

// Disconnect
router.delete('/disconnect', requireAuth, disconnectSlack);

export default router;
