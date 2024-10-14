import { fakeJson } from '@/__tests__/faker';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { flushByPrefix } from '@/__tests__/redis-helper';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { CachedQueryResolver } from '@/datasources/db/cached-query-resolver';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { InternalServerErrorException } from '@nestjs/common';
import type postgres from 'postgres';
import type { MaybeRow } from 'postgres';
import type { RedisClientType } from 'redis';

const mockLoggingService = jest.mocked({
  debug: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockQuery = jest.mocked({
  execute: jest.fn(),
} as jest.MockedObjectDeep<postgres.PendingQuery<MaybeRow[]>>);

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('CachedQueryResolver', () => {
  let redisCacheService: RedisCacheService;
  let redisClient: RedisClientType;
  let target: CachedQueryResolver;
  const cachePrefix = crypto.randomUUID();

  beforeAll(async () => {
    redisClient = await redisClientFactory();
    redisCacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      mockConfigurationService,
      cachePrefix,
    );
    target = new CachedQueryResolver(mockLoggingService, redisCacheService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await flushByPrefix(redisClient, cachePrefix);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('get', () => {
    it('should return the content from cache if it exists', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const value = fakeJson();
      await redisCacheService.hSet(cacheDir, JSON.stringify(value), ttl);

      const actual = await target.get({
        cacheDir,
        query: mockQuery,
        ttl,
      });

      expect(actual).toBe(value);
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'cache_hit',
        key: 'key',
        field: 'field',
      });
    });

    it('should execute the query and cache the result if the cache is empty', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const dbResult = { ...JSON.parse(fakeJson()), count: 1 };
      mockQuery.execute.mockImplementation(() => dbResult);

      const actual = await target.get({
        cacheDir,
        query: mockQuery,
        ttl,
      });

      expect(actual).toBe(dbResult);
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'cache_miss',
        key: 'key',
        field: 'field',
      });
      const cacheContent = await redisCacheService.hGet(cacheDir);
      expect(cacheContent).toBe(JSON.stringify(dbResult));
    });

    it('should log the error and throw a generic error if the query fails', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const error = new Error('error');
      mockQuery.execute.mockRejectedValue(error);

      await expect(
        target.get({
          cacheDir,
          query: mockQuery,
          ttl,
        }),
      ).rejects.toThrow(
        new InternalServerErrorException('Internal Server Error'),
      );

      expect(mockLoggingService.error).toHaveBeenCalledWith('error');
    });
  });
});
