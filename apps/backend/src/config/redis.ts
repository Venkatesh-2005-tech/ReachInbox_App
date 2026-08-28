import IORedis from 'ioredis';
import { env } from './env';

// Shared Redis connection for BullMQ
export const redisConnection = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('error', (err) => console.error('❌ Redis error:', err.message));

// Separate client for rate limiting (non-BullMQ)
export const redisClient = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
});

redisClient.on('connect', () => console.log('✅ Redis rate-limit client connected'));
redisClient.on('error', (err) => console.error('❌ Redis rate-limit error:', err.message));
