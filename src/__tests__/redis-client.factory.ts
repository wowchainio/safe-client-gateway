import type { RedisClientType } from 'redis';
import { createClient } from 'redis';

export async function redisClientFactory(
  database?: number,
): Promise<RedisClientType> {
  const { REDIS_HOST = 'localhost', REDIS_PORT = 6379 } = process.env;
  const client: RedisClientType = createClient({
    url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
    ...(database ? { database: database } : {}),
  });
  await client.connect();
  return client;
}
