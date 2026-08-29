import IORedis from 'ioredis';

const redisUrlString = process.env.REDIS_URL;

let redisConfig: any;

if (redisUrlString) {
  try {
    const url = new URL(redisUrlString);
    redisConfig = {
      host: url.hostname,
      port: Number(url.port) || 6379,
      username: url.username || 'default',
      password: url.password,
      tls: {
        rejectUnauthorized: false
      }
    };
  } catch (e) {
    redisConfig = redisUrlString;
  }
} else {
  redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  };
}

// Shared Redis connection for BullMQ
export const redisConnection = new IORedis(redisConfig, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('connect', () => console.log('✅ Redis connected'));
redisConnection.on('error', (err) => console.error('❌ Redis error:', err.message));

// Separate client for rate limiting (non-BullMQ)
export const redisClient = new IORedis(redisConfig);

redisClient.on('connect', () => console.log('✅ Redis rate-limit client connected'));
redisClient.on('error', (err) => console.error('❌ Redis rate-limit error:', err.message));