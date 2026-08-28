import { Request, Response } from 'express';
import { env } from '../config/env';

export function getMe(req: Request, res: Response): void {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const { id, name, email, avatar, googleId } = req.user as {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    googleId: string | null;
  };
  res.json({ id, name, email, avatar, googleId });
}

export function logout(req: Request, res: Response): void {
  req.logout((err) => {
    if (err) {
      res.status(500).json({ error: 'Logout failed' });
      return;
    }
    req.session.destroy(() => {
      res.clearCookie('connect.sid');
      res.json({ success: true });
    });
  });
}

export function googleCallback(req: Request, res: Response): void {
  res.redirect(`${env.FRONTEND_URL}/dashboard`);
}
