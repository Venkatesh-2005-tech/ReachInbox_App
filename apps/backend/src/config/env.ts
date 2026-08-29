import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  WORKER_CONCURRENCY: z.coerce.number().default(5),
  MIN_EMAIL_DELAY_MS: z.coerce.number().default(2000),
  MAX_EMAILS_PER_HOUR: z.coerce.number().default(200),
  ETHEREAL_HOST: z.string().optional(),
  ETHEREAL_PORT: z.coerce.number().optional(),
  ETHEREAL_USER: z.string().optional(),
  ETHEREAL_PASSWORD: z.string().optional(),
  // Real SMTP — when set, all emails are delivered to actual inboxes
  // Works with Gmail App Password, Outlook, SendGrid, Mailgun, etc.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_SECURE: z.string().optional(), // "true" for port 465, omit for STARTTLS
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(), // "Your Name <you@gmail.com>"
  RESEND_API_KEY: z.string().optional(),
  // Ensure this line is present in your envSchema inside apps/backend/src/config/env.ts:
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:5000/auth/google/callback'),
  SLACK_CLIENT_ID: z.string().optional(),
  SLACK_CLIENT_SECRET: z.string().optional(),
  SLACK_REDIRECT_URI: z.string().default('http://localhost:5000/api/slack/callback'),
  SESSION_SECRET: z.string().default('change-me-to-a-long-random-secret'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;