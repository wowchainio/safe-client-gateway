import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/domain/safe/entities/__tests__/module-transaction.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import {
  nativeTokenTransferBuilder,
  toJson as nativeTokenTransferToJson,
} from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import type { Server } from 'net';
import { TestPostgresDatabaseModule } from '@/datasources/db/__tests__/test.postgres-database.module';
import { PostgresDatabaseModule } from '@/datasources/db/v1/postgres-database.module';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { TestPostgresDatabaseModuleV2 } from '@/datasources/db/v2/test.postgres-database.module';
import { TestTargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/__tests__/test.targeted-messaging.datasource.module';
import { TargetedMessagingDatasourceModule } from '@/datasources/targeted-messaging/targeted-messaging.datasource.module';
import { rawify } from '@/validation/entities/raw.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';

describe('Get by id - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  async function initApp(config: typeof configuration): Promise<void> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(config)],
    })
      .overrideModule(PostgresDatabaseModule)
      .useModule(TestPostgresDatabaseModule)
      .overrideModule(TargetedMessagingDatasourceModule)
      .useModule(TestTargetedMessagingDatasourceModule)
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

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  }

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        ethSign: true,
      },
    });

    await initApp(testConfiguration);
  });

  afterAll(async () => {
    await app.close();
  });
  it('Failure: Config API fails', async () => {
    const chainId = faker.string.numeric();
    const id = `module_${faker.string.uuid()}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        const error = new NetworkResponseError(new URL(getChainUrl), {
          status: 500,
        } as Response);
        return Promise.reject(error);
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/transactions/${id}`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(1);
    expect(networkService.get).toHaveBeenCalledWith({ url: getChainUrl });
  });

  it('Failure: Transaction API fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const moduleTransactionId = faker.string.uuid();
    const getModuleTransactionUrl = `${chain.transactionService}/api/v1/module-transaction/${moduleTransactionId}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getModuleTransactionUrl: {
          const error = new NetworkResponseError(
            new URL(getModuleTransactionUrl),
            {
              status: 500,
            } as Response,
          );
          return Promise.reject(error);
        }
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/module_${safe.address}_${moduleTransactionId}`,
      )
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith({ url: getChainUrl });
    expect(networkService.get).toHaveBeenCalledWith({
      url: getModuleTransactionUrl,
    });
  });

  it('Get module transaction by ID should return 404', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const id = faker.string.uuid();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getModuleTransactionUrl = `${chain.transactionService}/api/v1/module-transaction/${id}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getModuleTransactionUrl: {
          const error = new NetworkResponseError(
            new URL(getModuleTransactionUrl),
            {
              status: 404,
            } as Response,
          );
          return Promise.reject(error);
        }
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/module_${safe.address}_${id}`,
      )
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });
  });

  it('Get module transaction by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const contract = contractBuilder()
      .with('trustedForDelegateCall', false)
      .build();
    const moduleTransactionId = faker.string.uuid();
    const moduleTransaction = moduleTransactionBuilder()
      .with('safe', getAddress(safe.address))
      .with('data', null)
      .with('value', '15')
      .with('operation', Operation.CALL)
      .with('isSuccessful', true)
      .build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getModuleTransactionUrl = `${chain.transactionService}/api/v1/module-transaction/${moduleTransactionId}`;
    const getContractUrl = `${chain.transactionService}/api/v1/contracts/${moduleTransaction.to}`;
    const getModuleContractUrl = `${chain.transactionService}/api/v1/contracts/${moduleTransaction.module}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getModuleTransactionUrl:
          return Promise.resolve({
            data: rawify(moduleTransactionToJson(moduleTransaction)),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getModuleContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/module_${safe.address}_${moduleTransactionId}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          safeAddress: safe.address,
          txId: `module_${safe.address}_${moduleTransaction.moduleTransactionId}`,
          executedAt: moduleTransaction.executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Transfer',
            sender: expect.objectContaining({ value: safe.address }),
            recipient: expect.objectContaining({ value: contract.address }),
            direction: 'OUTGOING',
            transferInfo: {
              type: 'NATIVE_COIN',
              value: moduleTransaction.value,
            },
            humanDescription: null,
          },
          txData: {
            to: expect.objectContaining({ value: contract.address }),
            value: moduleTransaction.value,
            hexData: moduleTransaction.data,
            dataDecoded: moduleTransaction.dataDecoded,
            operation: Operation.CALL,
            addressInfoIndex: null,
            trustedDelegateCallTarget: null,
          },
          detailedExecutionInfo: {
            type: 'MODULE',
            address: expect.objectContaining({ value: contract.address }),
          },
          txHash: moduleTransaction.transactionHash,
          safeAppInfo: null,
          note: null,
        });
      });
  });

  it('Get an ERC20 transfer by ID should return 404', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const id = faker.string.uuid();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getTransferUrl = `${chain.transactionService}/api/v1/transfer/${id}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getTransferUrl: {
          const error = new NetworkResponseError(new URL(getTransferUrl), {
            status: 404,
          } as Response);
          return Promise.reject(error);
        }
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/transfer_${safe.address}_${id}`,
      )
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });
  });

  it('Get an native token transfer by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const contract = contractBuilder().build();
    const transferId = faker.string.uuid();
    const transfer = nativeTokenTransferBuilder()
      .with('transferId', transferId)
      .with('to', safe.address)
      .build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getTransferUrl = `${chain.transactionService}/api/v1/transfer/${transferId}`;
    const getFromContractUrl = `${chain.transactionService}/api/v1/contracts/${transfer.from}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${transfer.to}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getTransferUrl:
          return Promise.resolve({
            data: rawify(nativeTokenTransferToJson(transfer)),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getFromContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/transfer_${safe.address}_${transferId}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `transfer_${safe.address}_${transfer.transferId}`,
          executedAt: transfer.executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Transfer',
            sender: expect.objectContaining({ value: contract.address }),
            recipient: expect.objectContaining({ value: contract.address }),
            direction: 'INCOMING',
            transferInfo: {
              type: 'NATIVE_COIN',
              value: transfer.value,
            },
          },
          txData: null,
          detailedExecutionInfo: null,
          txHash: transfer.transactionHash,
          safeAppInfo: null,
          note: null,
        });
      });
  });

  it('Get an Multisig Transaction by ID should return 404', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder().build();
    const txHash = faker.string.hexadecimal();
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${txHash}/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getMultisigTransactionUrl: {
          const error = new NetworkResponseError(
            new URL(getMultisigTransactionUrl),
            {
              status: 404,
            } as Response,
          );
          return Promise.reject(error);
        }
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${txHash}`,
      )
      .expect(404)
      .expect({
        message: 'An error occurred',
        code: 404,
      });
  });

  it('Get an Multisig Transaction by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const contract = contractBuilder().build();
    const executionDate = faker.date.recent();
    const safeTxGas = faker.number.int();
    const gasPrice = faker.string.numeric();
    const baseGas = faker.number.int();
    const tx = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('operation', 0)
      .with('data', faker.string.hexadecimal({ length: 32 }) as `0x${string}`)
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('executionDate', executionDate)
      .with('safeTxGas', safeTxGas)
      .with('gasPrice', gasPrice)
      .with('baseGas', baseGas)
      .buildWithConfirmations({
        chainId,
        safe,
        signers,
      });
    const rejectionTx = multisigTransactionBuilder().build();
    const rejectionTxsPage = pageBuilder()
      .with('results', [multisigToJson(rejectionTx)])
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const gasToken = tokenBuilder().build();
    const token = tokenBuilder().build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${tx.gasToken}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${tx.to}`;
    const getToTokenUrl = `${chain.transactionService}/api/v1/tokens/${tx.to}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(tx)),
            status: 200,
          });
        case getMultisigTransactionsUrl:
          return Promise.resolve({
            data: rawify(rejectionTxsPage),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: rawify(gasToken), status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getToTokenUrl:
          return Promise.resolve({ data: rawify(token), status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({
            data: rawify(safeAppsResponse),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${tx.safeTxHash}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${safe.address}_${tx.safeTxHash}`,
          executedAt: executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Custom',
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            dataSize: '16',
            value: Number(tx.value).toString(),
            methodName: tx.dataDecoded?.method,
            actionCount: null,
            isCancellation: false,
          },
          txData: {
            hexData: tx.data,
            dataDecoded: tx.dataDecoded,
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            value: tx.value,
            operation: tx.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
          detailedExecutionInfo: {
            type: 'MULTISIG',
            submittedAt: tx.submissionDate.getTime(),
            nonce: tx.nonce,
            safeTxGas: safeTxGas.toString(),
            baseGas: baseGas.toString(),
            gasPrice,
            refundReceiver: expect.objectContaining({
              value: tx.refundReceiver,
            }),
            safeTxHash: tx.safeTxHash,
            executor: expect.objectContaining({ value: tx.executor }),
            signers: [
              expect.objectContaining({ value: safe.owners[0] }),
              expect.objectContaining({ value: safe.owners[1] }),
            ],
            confirmationsRequired: tx.confirmationsRequired,
            confirmations: [
              {
                signer: expect.objectContaining({
                  value: tx.confirmations![0].owner,
                }),
                signature: tx.confirmations![0].signature,
                submittedAt: tx.confirmations![0].submissionDate.getTime(),
              },
              {
                signer: expect.objectContaining({
                  value: tx.confirmations![1].owner,
                }),
                signature: tx.confirmations![1].signature,
                submittedAt: tx.confirmations![1].submissionDate.getTime(),
              },
            ],
            rejectors: expect.arrayContaining([
              expect.objectContaining({
                value: rejectionTx.confirmations![0].owner,
              }),
            ]),
            gasToken: tx.gasToken,
            gasTokenInfo: gasToken,
            trusted: tx.trusted,
          },
          txHash: tx.transactionHash,
          safeAppInfo: {
            name: safeAppsResponse[0].name,
            url: safeAppsResponse[0].url,
            logoUri: safeAppsResponse[0].iconUrl,
          },
        });
      });
  });

  it('Get an Multisig Transaction by safeTxHash', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const contract = contractBuilder().build();
    const executionDate = faker.date.recent();
    const safeTxGas = faker.number.int();
    const gasPrice = faker.string.numeric();
    const baseGas = faker.number.int();
    const tx = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('operation', 0)
      .with('data', faker.string.hexadecimal({ length: 32 }) as `0x${string}`)
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('executionDate', executionDate)
      .with('safeTxGas', safeTxGas)
      .with('gasPrice', gasPrice)
      .with('baseGas', baseGas)
      .buildWithConfirmations({
        signers,
        chainId: chain.chainId,
        safe,
      });
    const rejectionTx = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .buildWithConfirmations({
        signers: [signers[0]],
        chainId: chain.chainId,
        safe,
      });
    const rejectionTxsPage = pageBuilder()
      .with('results', [multisigToJson(rejectionTx)])
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const gasToken = tokenBuilder().build();
    const token = tokenBuilder().build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getMultisigTransactionUrl = `${
      chain.transactionService
    }/api/v1/multisig-transactions/${tx.safeTxHash.slice(2)}/`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${tx.gasToken}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${tx.to}`;
    const getToTokenUrl = `${chain.transactionService}/api/v1/tokens/${tx.to}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(tx)),
            status: 200,
          });
        case getMultisigTransactionsUrl:
          return Promise.resolve({
            data: rawify(rejectionTxsPage),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: rawify(gasToken), status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getToTokenUrl:
          return Promise.resolve({ data: rawify(token), status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({
            data: rawify(safeAppsResponse),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash.slice(2)}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${safe.address}_${tx.safeTxHash}`,
          executedAt: executionDate.getTime(),
          txStatus: 'SUCCESS',
          txInfo: {
            type: 'Custom',
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            dataSize: '16',
            value: Number(tx.value).toString(),
            methodName: tx.dataDecoded?.method,
            actionCount: null,
            isCancellation: false,
          },
          txData: {
            hexData: tx.data,
            dataDecoded: tx.dataDecoded,
            to: {
              value: token.address,
              name: token.name,
              logoUri: token.logoUri,
            },
            value: tx.value,
            operation: tx.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
          detailedExecutionInfo: {
            type: 'MULTISIG',
            submittedAt: tx.submissionDate.getTime(),
            nonce: tx.nonce,
            safeTxGas: safeTxGas.toString(),
            baseGas: baseGas.toString(),
            gasPrice,
            refundReceiver: expect.objectContaining({
              value: tx.refundReceiver,
            }),
            safeTxHash: tx.safeTxHash,
            executor: expect.objectContaining({ value: tx.executor }),
            signers: [
              expect.objectContaining({ value: safe.owners[0] }),
              expect.objectContaining({ value: safe.owners[1] }),
            ],
            confirmationsRequired: tx.confirmationsRequired,
            confirmations: [
              {
                signer: expect.objectContaining({
                  value: tx.confirmations![0].owner,
                }),
                signature: tx.confirmations![0].signature,
                submittedAt: tx.confirmations![0].submissionDate.getTime(),
              },
              {
                signer: expect.objectContaining({
                  value: tx.confirmations![1].owner,
                }),
                signature: tx.confirmations![1].signature,
                submittedAt: tx.confirmations![1].submissionDate.getTime(),
              },
            ],
            rejectors: expect.arrayContaining([
              expect.objectContaining({
                value: rejectionTx.confirmations![0].owner,
              }),
            ]),
            gasToken: tx.gasToken,
            gasTokenInfo: gasToken,
            trusted: tx.trusted,
          },
          txHash: tx.transactionHash,
          safeAppInfo: {
            name: safeAppsResponse[0].name,
            url: safeAppsResponse[0].url,
            logoUri: safeAppsResponse[0].iconUrl,
          },
        });
      });
  });

  it('Get a CANCELLED Multisig Transaction by ID', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .with('nonce', 5)
      .build();
    const contract = contractBuilder().build();
    const executionDate = faker.date.recent();
    const safeTxGas = faker.number.int();
    const gasPrice = faker.string.numeric();
    const baseGas = faker.number.int();
    const tx = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('operation', 0)
      .with('nonce', 4)
      .with('data', faker.string.hexadecimal({ length: 32 }) as `0x${string}`)
      .with('isExecuted', false)
      .with('isSuccessful', null)
      .with('executionDate', executionDate)
      .with('safeTxGas', safeTxGas)
      .with('gasPrice', gasPrice)
      .with('baseGas', baseGas)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers,
        safe,
      });
    const rejectionTx = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers,
        safe,
      });
    const rejectionTxsPage = pageBuilder()
      .with('results', [multisigToJson(rejectionTx)])
      .build();
    const safeAppsResponse = [
      safeAppBuilder()
        .with('url', faker.internet.url({ appendSlash: false }))
        .with('iconUrl', faker.internet.url({ appendSlash: false }))
        .with('name', faker.word.words())
        .build(),
    ];
    const gasToken = tokenBuilder().build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${tx.safeTxHash}/`;
    const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
    const getGasTokenContractUrl = `${chain.transactionService}/api/v1/tokens/${tx.gasToken}`;
    const getToContractUrl = `${chain.transactionService}/api/v1/contracts/${tx.to}`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(tx)),
            status: 200,
          });
        case getMultisigTransactionsUrl:
          return Promise.resolve({
            data: rawify(rejectionTxsPage),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        case getGasTokenContractUrl:
          return Promise.resolve({ data: rawify(gasToken), status: 200 });
        case getToContractUrl:
          return Promise.resolve({ data: rawify(contract), status: 200 });
        case getSafeAppsUrl:
          return Promise.resolve({
            data: rawify(safeAppsResponse),
            status: 200,
          });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${tx.safeTxHash}`,
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          safeAddress: safe.address,
          txId: `multisig_${safe.address}_${tx.safeTxHash}`,
          executedAt: executionDate.getTime(),
          txStatus: 'CANCELLED',
          txInfo: {
            type: 'Custom',
            to: {
              value: contract.address,
              name: contract.displayName,
              logoUri: contract.logoUri,
            },
            dataSize: expect.any(String),
            value: expect.any(String),
            methodName: tx.dataDecoded?.method,
            actionCount: null,
            isCancellation: false,
          },
          txData: {
            hexData: tx.data,
            dataDecoded: tx.dataDecoded,
            to: {
              value: contract.address,
              name: contract.displayName,
              logoUri: contract.logoUri,
            },
            value: tx.value,
            operation: tx.operation,
            trustedDelegateCallTarget: null,
            addressInfoIndex: null,
          },
          detailedExecutionInfo: {
            submittedAt: tx.submissionDate.getTime(),
            nonce: tx.nonce,
            safeTxGas: safeTxGas.toString(),
            baseGas: baseGas.toString(),
            gasPrice,
            refundReceiver: expect.objectContaining({
              value: tx.refundReceiver,
            }),
            safeTxHash: tx.safeTxHash,
            executor: expect.objectContaining({ value: tx.executor }),
            signers: expect.arrayContaining([
              expect.objectContaining({ value: safe.owners[0] }),
              expect.objectContaining({ value: safe.owners[1] }),
            ]),
            confirmationsRequired: tx.confirmationsRequired,
            confirmations: expect.arrayContaining([
              expect.objectContaining({
                signer: expect.objectContaining({
                  value: tx.confirmations![0].owner,
                }),
                signature: tx.confirmations![0].signature,
                submittedAt: tx.confirmations![0].submissionDate.getTime(),
              }),
              expect.objectContaining({
                signer: expect.objectContaining({
                  value: tx.confirmations![1].owner,
                }),
                signature: tx.confirmations![1].signature,
                submittedAt: tx.confirmations![1].submissionDate.getTime(),
              }),
            ]),
            rejectors: expect.arrayContaining([
              expect.objectContaining({
                value: rejectionTx.confirmations![0].owner,
              }),
              expect.objectContaining({
                value: rejectionTx.confirmations![1].owner,
              }),
            ]),
            gasToken: tx.gasToken,
            gasTokenInfo: gasToken,
            trusted: tx.trusted,
          },
          txHash: tx.transactionHash,
          safeAppInfo: {
            name: safeAppsResponse[0].name,
            url: safeAppsResponse[0].url,
            logoUri: safeAppsResponse[0].iconUrl,
          },
        });
      });
  });

  it('should return a 502 if there is a safeTxHash mismatch', async () => {
    const chainId = faker.string.numeric();
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder()
      .with('owners', [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ])
      .build();
    const multisigTransaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(multisigTransaction)),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
      )
      .expect(502)
      .expect({
        message: 'Invalid safeTxHash',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if there are duplicate owners in a confirmation', async () => {
    const chain = chainBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safe = safeBuilder()
      .with('owners', [
        signer.address,
        getAddress(faker.finance.ethereumAddress()),
      ])
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        safe,
        signers: [signer, signer],
      });
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(multisigTransaction)),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
      )
      .expect(502)
      .expect({
        message: 'Duplicate owners in confirmations',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if there are duplicate signatures in a confirmation', async () => {
    const chain = chainBuilder().build();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safe = safeBuilder()
      .with('owners', [
        signer.address,
        getAddress(faker.finance.ethereumAddress()),
      ])
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        safe,
        signers: [signer],
      });
    multisigTransaction.confirmations!.push({
      ...multisigTransaction.confirmations![0],
      owner: getAddress(faker.finance.ethereumAddress()),
    });
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(multisigTransaction)),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
      )
      .expect(502)
      .expect({
        message: 'Duplicate signatures in confirmations',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if there are invalid EOA confirmations', async () => {
    const chainId = faker.string.numeric();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder()
      .with('owners', [
        signer.address,
        getAddress(faker.finance.ethereumAddress()),
      ])
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers: [signer],
        safe,
        signatureType: SignatureType.Eoa,
      });
    multisigTransaction.confirmations![0].owner = getAddress(
      faker.finance.ethereumAddress(),
    );
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(multisigTransaction)),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
      )
      .expect(502)
      .expect({
        message: 'Invalid signature',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should return a 502 if there are invalid ETH_SIGN confirmations', async () => {
    const chainId = faker.string.numeric();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const chain = chainBuilder().with('chainId', chainId).build();
    const safe = safeBuilder()
      .with('owners', [
        signer.address,
        getAddress(faker.finance.ethereumAddress()),
      ])
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        chainId: chain.chainId,
        signers: [signer],
        safe,
        signatureType: SignatureType.EthSign,
      });
    multisigTransaction.confirmations![0].owner = getAddress(
      faker.finance.ethereumAddress(),
    );
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case getChainUrl:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case getMultisigTransactionUrl:
          return Promise.resolve({
            data: rawify(multisigToJson(multisigTransaction)),
            status: 200,
          });
        case getSafeUrl:
          return Promise.resolve({ data: rawify(safe), status: 200 });
        default:
          return Promise.reject(new Error(`Could not match ${url}`));
      }
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
      )
      .expect(502)
      .expect({
        message: 'Invalid signature',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });

  it('should block eth_sign', async () => {
    const baseConfiguration = configuration();
    const testConfiguration = (): typeof baseConfiguration => ({
      ...baseConfiguration,
      features: {
        ...baseConfiguration.features,
        ethSign: false,
      },
    });
    await initApp(testConfiguration);

    const chain = chainBuilder().build();
    const signers = Array.from(
      { length: faker.number.int({ min: 1, max: 5 }) },
      () => {
        const privateKey = generatePrivateKey();
        return privateKeyToAccount(privateKey);
      },
    );
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('nonce', safe.nonce)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .buildWithConfirmations({
        signers: signers,
        chainId: chain.chainId,
        safe,
        signatureType: SignatureType.EthSign,
      });
    const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
    const getMultisigTransactionUrl = `${chain.transactionService}/api/v1/multisig-transactions/${multisigTransaction.safeTxHash}/`;
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionUrl) {
        return Promise.resolve({
          data: rawify(multisigToJson(multisigTransaction)),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/transactions/multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
      )
      .expect(502)
      .expect({
        message: 'eth_sign is disabled',
        error: 'Bad Gateway',
        statusCode: 502,
      });
  });
});
