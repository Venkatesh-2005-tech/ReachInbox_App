import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';

const createSenderSchema = z.object({
  email: z.string().email(),
  etherealUser: z.string().optional(),
  etherealPassword: z.string().optional(),
});

export async function getSenders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;
    const senders = await prisma.sender.findMany({
      where: { userId },
      select: { id: true, email: true, createdAt: true, updatedAt: true },
    });
    res.json({ senders });
  } catch (err) {
    next(err);
  }
}

export async function createSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;
    const parsed = createSenderSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { email, etherealUser, etherealPassword } = parsed.data;

    const sender = await prisma.sender.upsert({
      where: { userId_email: { userId, email } },
      update: { etherealUser, etherealPassword },
      create: { userId, email, etherealUser, etherealPassword },
    });

    res.status(201).json({ sender: { id: sender.id, email: sender.email, createdAt: sender.createdAt } });
  } catch (err) {
    next(err);
  }
}

export async function deleteSender(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = (req.user as { id: string }).id;
    const { id } = req.params;

    const sender = await prisma.sender.findFirst({ where: { id, userId } });
    if (!sender) {
      res.status(404).json({ error: 'Sender not found' });
      return;
    }

    await prisma.sender.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}
