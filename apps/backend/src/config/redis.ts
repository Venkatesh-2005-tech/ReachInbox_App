import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL;

const redisConfig = redisUrl
  ? redisUrl
  : {
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    };

const tlsOptions = redisUrl ? { tls: { rejectUnauthorized: false } } : {};

// Shared Redis connection for BullMQ
export const redisConnection = new IORedis(redisConfig as any, {
  ...tlsOptions,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('error', (err) => console.error('❌ Redis error:', err.message));

// Separate client for rate limiting (non-BullMQ)
export const redisClient = new IORedis(redisConfig as any, {
  ...tlsOptions,
});

redisClient.on('connect', () => console.log('✅ Redis rate-limit client connected'));
redisClient.on('error', (err) => console.error('❌ Redis rate-limit error:', err.message));