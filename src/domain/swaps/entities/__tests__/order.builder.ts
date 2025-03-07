import type { Order } from '@/domain/swaps/entities/order.entity';
import {
  BuyTokenBalance,
  OrderClass,
  OrderKind,
  OrderStatus,
  SellTokenBalance,
} from '@/domain/swaps/entities/order.entity';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function orderBuilder(): IBuilder<Order> {
  const executedFee = faker.number.bigInt({ min: 1 });
  const sellToken = getAddress(faker.finance.ethereumAddress());
  return (
    new Builder<Order>()
      .with('sellToken', sellToken)
      .with('buyToken', getAddress(faker.finance.ethereumAddress()))
      .with(
        'receiver',
        faker.datatype.boolean()
          ? getAddress(faker.finance.ethereumAddress())
          : null,
      )
      .with('sellAmount', faker.number.bigInt({ min: 1 }))
      .with('buyAmount', faker.number.bigInt({ min: 1 }))
      .with('validTo', faker.date.future().getTime())
      .with(
        'appData',
        JSON.stringify({
          version: faker.system.semver(),
          metadata: {},
        }),
      )
      .with('feeAmount', faker.number.bigInt({ min: 1 }))
      .with('kind', faker.helpers.arrayElement([OrderKind.Buy, OrderKind.Sell]))
      .with('partiallyFillable', faker.datatype.boolean())
      .with(
        'sellTokenBalance',
        faker.helpers.arrayElement([
          SellTokenBalance.Erc20,
          SellTokenBalance.Internal,
          SellTokenBalance.External,
        ]),
      )
      .with(
        'buyTokenBalance',
        faker.helpers.arrayElement([
          BuyTokenBalance.Erc20,
          BuyTokenBalance.Internal,
        ]),
      )
      .with(
        'signingScheme',
        faker.helpers.arrayElement([
          'eip712',
          'ethsign',
          'presign',
          'eip1271',
        ] as const),
      )
      .with('signature', faker.string.hexadecimal() as `0x${string}`)
      .with(
        'from',
        faker.datatype.boolean()
          ? getAddress(faker.finance.ethereumAddress())
          : null,
      )
      .with('quoteId', faker.datatype.boolean() ? faker.number.int() : null)
      .with('creationDate', faker.date.recent())
      .with(
        'class',
        faker.helpers.arrayElement(
          Object.values(OrderClass).filter(
            (orderClass) => orderClass !== OrderClass.Unknown,
          ),
        ),
      )
      .with('owner', getAddress(faker.finance.ethereumAddress()))
      .with('uid', faker.string.hexadecimal({ length: 112 }))
      .with(
        'availableBalance',
        faker.datatype.boolean() ? faker.number.bigInt({ min: 1 }) : null,
      )
      .with('executedSellAmount', faker.number.bigInt({ min: 1 }))
      .with('executedSellAmountBeforeFees', faker.number.bigInt({ min: 1 }))
      .with('executedBuyAmount', faker.number.bigInt({ min: 1 }))
      .with('executedFeeAmount', faker.number.bigInt({ min: 1 }))
      .with('invalidated', faker.datatype.boolean())
      .with('status', faker.helpers.arrayElement(Object.values(OrderStatus)))
      .with('isLiquidityOrder', faker.datatype.boolean())
      .with(
        'ethflowData',
        faker.datatype.boolean()
          ? {
              refundTxHash: faker.datatype.boolean()
                ? (faker.string.hexadecimal() as `0x${string}`)
                : null,
              userValidTo: faker.date.future().getTime(),
            }
          : null,
      )
      .with(
        'onchainUser',
        faker.datatype.boolean()
          ? getAddress(faker.finance.ethereumAddress())
          : null,
      )
      .with(
        'onchainOrderData',
        faker.datatype.boolean()
          ? {
              sender: getAddress(faker.finance.ethereumAddress()),
              placementError: faker.helpers.arrayElement([
                'QuoteNotFound',
                'ValidToTooFarInFuture',
                'PreValidationError',
              ] as const),
            }
          : null,
      )
      .with('executedFee', executedFee)
      // TODO: still tbd by CoW but this will be expressed in SURPLUS tokens
      // (BUY tokens for SELL orders and SELL tokens for BUY orders)
      .with('executedFeeToken', sellToken)
      .with('fullAppData', faker.datatype.boolean() ? JSON.stringify({}) : null)
  );
}
