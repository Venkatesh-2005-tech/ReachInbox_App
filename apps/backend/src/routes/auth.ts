import { Router } from 'express';
import passport from 'passport';
import { getMe, logout, googleCallback } from '../controllers/authController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Initiate Google OAuth flow
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google_auth_failed' }),
  googleCallback,
);

// Get current authenticated user
router.get('/me', requireAuth, getMe);

// Logout
router.post('/logout', requireAuth, logout);

export default router;
