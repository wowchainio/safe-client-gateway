import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import type { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { IBalancesApiManager } from '@/domain/interfaces/balances-api.manager.interface';
import { IStakingApiManager } from '@/domain/interfaces/staking-api.manager.interface';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';

describe('Post Hook Events for Cache (Unit)', () => {
  let app: INestApplication<Server>;
  let authToken: string;
  let safeConfigUrl: string;
  let fakeCacheService: FakeCacheService;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let configurationService: IConfigurationService;
  let stakingApiManager: IStakingApiManager;
  let blockchainApiManager: IBlockchainApiManager;
  let transactionApiManager: ITransactionApiManager;
  let balancesApiManager: IBalancesApiManager;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(PostgresDatabaseModuleV2)
      .useModule(TestPostgresDatabaseModuleV2)
      .compile();
    app = moduleFixture.createNestApplication();

    fakeCacheService = moduleFixture.get<FakeCacheService>(CacheService);
    configurationService = moduleFixture.get(IConfigurationService);
    stakingApiManager =
      moduleFixture.get<IStakingApiManager>(IStakingApiManager);
    blockchainApiManager = moduleFixture.get<IBlockchainApiManager>(
      IBlockchainApiManager,
    );
    transactionApiManager = moduleFixture.get(ITransactionApiManager);
    balancesApiManager = moduleFixture.get(IBalancesApiManager);
    authToken = configurationService.getOrThrow('auth.token');
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();
    await initApp(configuration);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chain', async (payload) => {
    const chain = chainBuilder().build();
    const cacheDir = new CacheDir(`${chain.chainId}_chain`, '');
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: chain, status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears chains', async (payload) => {
    const chain = chainBuilder().build();
    const cacheDir = new CacheDir(`chains`, '');
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chain.chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeUndefined();
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the staking API', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await stakingApiManager.getApi(chainId);

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    const newApi = await stakingApiManager.getApi(chainId);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the blockchain API', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await blockchainApiManager.getApi(chainId);

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    const newApi = await blockchainApiManager.getApi(chainId);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the transaction API', async (payload) => {
    const chainId = faker.string.numeric();
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await transactionApiManager.getApi(chainId);

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    const newApi = await transactionApiManager.getApi(chainId);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'CHAIN_UPDATE',
    },
  ])('$type clears the balances API', async (payload) => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const data = {
      chainId: chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chainId}`:
          return Promise.resolve({
            data: chainBuilder().with('chainId', chainId).build(),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });
    const api = await balancesApiManager.getApi(chainId, safeAddress);

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    const newApi = await balancesApiManager.getApi(chainId, safeAddress);
    expect(api).not.toBe(newApi);
  });

  it.each([
    {
      type: 'SAFE_APPS_UPDATE',
    },
  ])('$type clears safe apps', async (payload) => {
    const chain = chainBuilder().build();
    const cacheDir = new CacheDir(`${chain.chainId}_safe_apps`, '');
    await fakeCacheService.hSet(
      cacheDir,
      JSON.stringify(chain),
      faker.number.int({ min: 1 }),
    );
    const data = {
      chainId: chain.chainId,
      ...payload,
    };
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({
            data: chain,
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .post(`/hooks/events`)
      .set('Authorization', `Basic ${authToken}`)
      .send(data)
      .expect(202);

    await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeUndefined();
  });
});
