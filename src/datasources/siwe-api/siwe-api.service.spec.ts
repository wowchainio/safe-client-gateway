import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { flushByPrefix } from '@/__tests__/redis-helper';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { SiweApi } from '@/datasources/siwe-api/siwe-api.service';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import type { RedisClientType } from 'redis';

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('SiweApiService', () => {
  let service: SiweApi;
  let fakeConfigurationService: FakeConfigurationService;
  let redisCacheService: RedisCacheService;
  let redisClient: RedisClientType;
  const nonceTtlInSeconds = faker.number.int();
  const cachePrefix = crypto.randomUUID();

  beforeAll(async () => {
    redisClient = await redisClientFactory();
    redisCacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      mockConfigurationService,
      cachePrefix,
    );
  });

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('auth.nonceTtlSeconds', nonceTtlInSeconds);
    service = new SiweApi(fakeConfigurationService, redisCacheService);
  });

  afterEach(async () => {
    await flushByPrefix(redisClient, cachePrefix);
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('storeNonce', () => {
    it('should stored the nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);

      await expect(
        redisCacheService.hGet(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(nonce);
    });
  });

  describe('getNonce', () => {
    it('should return the stored nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);
      const expected = await service.getNonce(nonce);

      expect(expected).toBe(nonce);
    });
  });

  describe('clearNonce', () => {
    it('should clear the stored nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);
      await service.clearNonce(nonce);

      await expect(
        redisCacheService.hGet(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(null);
    });
  });
});
