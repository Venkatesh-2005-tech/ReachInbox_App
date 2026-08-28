import { Router } from 'express';
import multer from 'multer';

import {
  scheduleEmails,
  getScheduledEmails,
  getSentEmails,
  searchEmailsHandler,
} from '../controllers/emailController';

import { requireAuth } from '../middleware/auth';

const router = Router();

/**
 * Store uploaded files in memory temporarily.
 *
 * The controller immediately writes them to disk.
 *
 * IMPORTANT:
 * Do not put these buffers into BullMQ.
 */
const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 5,
  },
});

router.use(requireAuth);

router.post(
  '/schedule',
  upload.array('attachments', 5),
  scheduleEmails,
);

router.get(
  '/scheduled',
  getScheduledEmails,
);

router.get(
  '/sent',
  getSentEmails,
);

router.get(
  '/search',
  searchEmailsHandler,
);

export default router;