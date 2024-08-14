import { Builder, IBuilder } from '@/__tests__/builder';
import { PooledStaking } from '@/datasources/staking-api/entities/pooled-staking.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

type RevenueMetrics = PooledStaking[
  | 'one_year'
  | 'six_month'
  | 'three_month'
  | 'one_month'
  | 'one_week'];
function pooledStakingStatsPeriodRevenueMetricsBuilder(): IBuilder<RevenueMetrics> {
  return new Builder<RevenueMetrics>()
    .with('grr', faker.number.float())
    .with('nrr', faker.number.float());
}

type Pool = PooledStaking['pools'][number];
function pooledStakingStatsPoolBuilder(): IBuilder<Pool> {
  return new Builder<Pool>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', faker.lorem.word())
    .with('ratio', faker.number.int())
    .with('commission', faker.number.int())
    .with('total_deposited', faker.string.numeric())
    .with('factory_address', getAddress(faker.finance.ethereumAddress()))
    .with('operator_address', getAddress(faker.finance.ethereumAddress()));
}

export function pooledStakingStatsBuilder(): IBuilder<PooledStaking> {
  return new Builder<PooledStaking>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', faker.lorem.sentence())
    .with('symbol', faker.finance.currencyCode())
    .with('fee', faker.number.int())
    .with('total_supply', faker.string.numeric())
    .with('total_underlying_supply', faker.string.numeric())
    .with('total_stakers', faker.number.int({ min: 1 }))
    .with('nrr', faker.number.float())
    .with('grr', faker.number.float())
    .with('one_year', pooledStakingStatsPeriodRevenueMetricsBuilder().build())
    .with('six_month', pooledStakingStatsPeriodRevenueMetricsBuilder().build())
    .with(
      'three_month',
      pooledStakingStatsPeriodRevenueMetricsBuilder().build(),
    )
    .with('one_month', pooledStakingStatsPeriodRevenueMetricsBuilder().build())
    .with('one_week', pooledStakingStatsPeriodRevenueMetricsBuilder().build())
    .with('pools', [pooledStakingStatsPoolBuilder().build()]);
}
