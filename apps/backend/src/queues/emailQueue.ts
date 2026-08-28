import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis';
import { EmailJobData } from '../types';

export const emailQueue = new Queue<EmailJobData>('email-queue', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000,
    },
    removeOnFail: {
      count: 500,
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('❌ Email queue error:', err.message);
});

console.log('✅ Email queue initialized');
