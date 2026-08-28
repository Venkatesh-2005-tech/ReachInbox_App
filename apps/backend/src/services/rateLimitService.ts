import { redisClient } from '../config/redis';
import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * Returns the Redis key for the hourly rate-limit counter.
 * Window is 1-hour blocks keyed by UTC hour.
 */
function getRateLimitKey(senderId: string): string {
  const now = new Date();
  const hourWindow = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  return `email-rate:${senderId}:${hourWindow}`;
}

/**
 * Atomically increment the hourly send counter.
 * Returns true if allowed (under limit), false if rate-limited.
 */
export async function checkAndIncrementRateLimit(senderId: string): Promise<boolean> {
  const key = getRateLimitKey(senderId);
  const limit = env.MAX_EMAILS_PER_HOUR;

  // Use a Lua script for atomic check-and-increment
  const luaScript = `
    local current = redis.call('GET', KEYS[1])
    if current and tonumber(current) >= tonumber(ARGV[1]) then
      return 0
    end
    local newVal = redis.call('INCR', KEYS[1])
    if newVal == 1 then
      redis.call('EXPIRE', KEYS[1], 3600)
    end
    return 1
  `;

  const result = await redisClient.eval(luaScript, 1, key, limit.toString());
  const allowed = result === 1;

  if (!allowed) {
    logger.warn(`Rate limit reached for sender ${senderId} (limit: ${limit}/hour)`);
  }

  return allowed;
}

/**
 * Calculate how many ms until the next hourly window starts.
 */
export function msUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(now.getUTCHours() + 1, 0, 0, 0);
  return nextHour.getTime() - now.getTime();
}

/**
 * Get current count for a sender in the current hour.
 */
export async function getCurrentHourCount(senderId: string): Promise<number> {
  const key = getRateLimitKey(senderId);
  const val = await redisClient.get(key);
  return val ? parseInt(val, 10) : 0;
}
