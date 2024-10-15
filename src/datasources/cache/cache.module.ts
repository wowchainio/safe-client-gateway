import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheService } from '@/datasources/cache/cache.service.interface';
import { CacheKeyPrefix } from '@/datasources/cache/constants';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { CacheReadiness } from '@/domain/interfaces/cache-readiness.interface';
import { ILoggingService, LoggingService } from '@/logging/logging.interface';
import { Global, Module } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

async function redisClientFactory(
  configurationService: IConfigurationService,
  loggingService: ILoggingService,
): Promise<RedisClientType> {
  const redisHost = configurationService.getOrThrow<string>('redis.host');
  const redisPort = configurationService.getOrThrow<string>('redis.port');
  const client: RedisClientType = createClient({
    url: `redis://${redisHost}:${redisPort}`,
  });
  client.on('error', (err) =>
    loggingService.error(`Redis client error: ${err}`),
  );
  await client.connect();
  return client;
}

@Global()
@Module({
  providers: [
    {
      provide: 'RedisClient',
      useFactory: redisClientFactory,
      inject: [IConfigurationService, LoggingService],
    },
    { provide: CacheService, useClass: RedisCacheService },
    { provide: CacheReadiness, useExisting: CacheService },
    { provide: CacheKeyPrefix, useValue: '' },
  ],
  exports: [CacheService, CacheReadiness],
})
export class CacheModule {}
