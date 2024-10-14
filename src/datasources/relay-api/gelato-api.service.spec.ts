import { redisClientFactory } from '@/__tests__/redis-client.factory';
import { flushByPrefix } from '@/__tests__/redis-helper';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { GelatoApi } from '@/datasources/relay-api/gelato-api.service';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import type { RedisClientType } from 'redis';
import type { Hex } from 'viem';
import { getAddress } from 'viem';

const mockNetworkService = jest.mocked({
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

describe('GelatoApi', () => {
  let target: GelatoApi;
  let fakeConfigurationService: FakeConfigurationService;
  let redisCacheService: RedisCacheService;
  let redisClient: RedisClientType;
  let baseUri: string;
  let ttlSeconds: number;
  let httpErrorFactory: HttpErrorFactory;
  const cachePrefix = crypto.randomUUID();

  beforeAll(async () => {
    redisClient = await redisClientFactory(
      faker.number.int({ min: 1, max: 10 }),
    );
    redisCacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      mockConfigurationService,
      cachePrefix,
    );
  });

  beforeEach(() => {
    jest.resetAllMocks();
    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    baseUri = faker.internet.url({ appendSlash: false });
    ttlSeconds = faker.number.int();
    fakeConfigurationService.set('relay.baseUri', baseUri);
    fakeConfigurationService.set('relay.ttlSeconds', ttlSeconds);

    target = new GelatoApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
      redisCacheService,
    );
  });

  afterEach(async () => {
    await flushByPrefix(redisClient, cachePrefix);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  it('should error if baseUri is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();
    const httpErrorFactory = new HttpErrorFactory();

    expect(
      () =>
        new GelatoApi(
          mockNetworkService,
          fakeConfigurationService,
          httpErrorFactory,
          redisCacheService,
        ),
    ).toThrow();
  });

  describe('relay', () => {
    it('should relay the payload', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const apiKey = faker.string.sample();
      const taskId = faker.string.uuid();
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: {
          taskId,
        },
      });

      await target.relay({
        chainId,
        to: address,
        data,
        gasLimit: null,
      });

      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/relays/v2/sponsored-call`,
        data: {
          sponsorApiKey: apiKey,
          chainId,
          target: address,
          data,
        },
      });
    });

    it('should add a gas buffer if a gas limit is provided', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const gasLimit = faker.number.bigInt();
      const apiKey = faker.string.sample();
      const taskId = faker.string.uuid();
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockResolvedValueOnce({
        status: 200,
        data: {
          taskId,
        },
      });

      await target.relay({
        chainId,
        to: address,
        data,
        gasLimit,
      });

      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/relays/v2/sponsored-call`,
        data: {
          sponsorApiKey: apiKey,
          chainId,
          target: address,
          data,
          gasLimit: (gasLimit + BigInt(150_000)).toString(),
        },
      });
    });

    it('should throw if there is no API key preset', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
          gasLimit: null,
        }),
      ).rejects.toThrow();
    });

    it('should forward error', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const data = faker.string.hexadecimal() as Hex;
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const apiKey = faker.string.sample();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/relays/v2/sponsored-call`),
        {
          status,
        } as Response,
        {
          message: 'Unexpected error',
        },
      );
      fakeConfigurationService.set(`relay.apiKey.${chainId}`, apiKey);
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        target.relay({
          chainId,
          to: address,
          data,
          gasLimit: null,
        }),
      ).rejects.toThrow(new DataSourceError('Unexpected error', status));
    });
  });

  describe('getRelayCount', () => {
    it('should return the count', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const count = faker.number.int({ min: 1 });
      await redisCacheService.hSet(
        new CacheDir(`${chainId}_relay_${address}`, ''),
        count.toString(),
        ttlSeconds,
      );

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toBe(count);
    });

    it('should return 0 if the count is not cached', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());

      const result = await target.getRelayCount({
        chainId,
        address,
      });

      expect(result).toBe(0);
    });
  });

  describe('setRelayCount', () => {
    it('should cache the count', async () => {
      const chainId = faker.string.numeric();
      const address = getAddress(faker.finance.ethereumAddress());
      const count = faker.number.int({ min: 1 });

      await target.setRelayCount({
        chainId,
        address,
        count,
      });

      const result = await redisCacheService.hGet(
        new CacheDir(`${chainId}_relay_${address}`, ''),
      );
      expect(result).toBe(count.toString());
    });
  });
});
