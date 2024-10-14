import type { RedisClientType } from 'redis';

/**
 * This function flushes all keys with a given prefix.
 *
 * @param client - The Redis client.
 * @param prefix - The prefix to match keys.
 */
export const flushByPrefix = async (
  client: RedisClientType,
  prefix: string,
): Promise<void> => {
  const pipeline = client.multi();
  for await (const key of client.scanIterator({ MATCH: `${prefix}*` })) {
    pipeline.del(key);
  }
  await pipeline.exec();
};
