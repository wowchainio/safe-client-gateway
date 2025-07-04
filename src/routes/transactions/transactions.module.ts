import { ChainsRepositoryModule } from '@/domain/chains/chains.repository.interface';
import { ContractsRepositoryModule } from '@/domain/contracts/contracts.repository.interface';
import { DataDecoderRepositoryModule } from '@/domain/data-decoder/v2/data-decoder.repository.module';
import { EarnRepositoryModule } from '@/domain/earn/earn.repository.module';
import { HumanDescriptionRepositoryModule } from '@/domain/human-description/human-description.repository.interface';
import { SafeAppsRepositoryModule } from '@/domain/safe-apps/safe-apps.repository.interface';
import { SafeRepositoryModule } from '@/domain/safe/safe.repository.interface';
import { StakingRepositoryModule } from '@/domain/staking/staking.repository.module';
import { GPv2DecoderModule } from '@/domain/swaps/contracts/decoders/gp-v2-decoder.helper';
import { SwapsRepositoryModule } from '@/domain/swaps/swaps-repository.module';
import { TokenRepositoryModule } from '@/domain/tokens/token.repository.interface';
import { AddressInfoModule } from '@/routes/common/address-info/address-info.module';
import { GPv2OrderHelper } from '@/routes/transactions/helpers/gp-v2-order.helper';
import { KilnNativeStakingHelperModule } from '@/routes/transactions/helpers/kiln-native-staking.helper';
import { SwapAppsHelperModule } from '@/routes/transactions/helpers/swap-apps.helper';
import { SwapOrderHelperModule } from '@/routes/transactions/helpers/swap-order.helper';
import { TwapOrderHelperModule } from '@/routes/transactions/helpers/twap-order.helper';
import { CustomTransactionMapper } from '@/routes/transactions/mappers/common/custom-transaction.mapper';
import { DataDecodedParamHelper } from '@/routes/transactions/mappers/common/data-decoded-param.helper';
import { Erc20TransferMapper } from '@/routes/transactions/mappers/common/erc20-transfer.mapper';
import { Erc721TransferMapper } from '@/routes/transactions/mappers/common/erc721-transfer.mapper';
import { HumanDescriptionMapper } from '@/routes/transactions/mappers/common/human-description.mapper';
import { NativeCoinTransferMapper } from '@/routes/transactions/mappers/common/native-coin-transfer.mapper';
import { NativeStakingMapper } from '@/routes/transactions/mappers/common/native-staking.mapper';
import { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import { SettingsChangeMapper } from '@/routes/transactions/mappers/common/settings-change.mapper';
import { SwapOrderMapperModule } from '@/routes/transactions/mappers/common/swap-order.mapper';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { TwapOrderMapperModule } from '@/routes/transactions/mappers/common/twap-order.mapper';
import { CreationTransactionMapper } from '@/routes/transactions/mappers/creation-transaction/creation-transaction.mapper';
import { ModuleTransactionDetailsMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-details.mapper';
import { ModuleTransactionStatusMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-status.mapper';
import { ModuleTransactionMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction.mapper';
import { MultisigTransactionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-details.mapper';
import { MultisigTransactionExecutionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import { MultisigTransactionExecutionInfoMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionNoteMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { MultisigTransactionMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction.mapper';
import { QueuedItemsMapper } from '@/routes/transactions/mappers/queued-items/queued-items.mapper';
import { TransactionPreviewMapper } from '@/routes/transactions/mappers/transaction-preview.mapper';
import { TransactionsHistoryMapper } from '@/routes/transactions/mappers/transactions-history.mapper';
import { SwapTransferInfoMapper } from '@/routes/transactions/mappers/transfers/swap-transfer-info.mapper';
import { TransferDetailsMapper } from '@/routes/transactions/mappers/transfers/transfer-details.mapper';
import { TransferImitationMapper } from '@/routes/transactions/mappers/transfers/transfer-imitation.mapper';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';
import { TransferMapper } from '@/routes/transactions/mappers/transfers/transfer.mapper';
import { TransactionsController } from '@/routes/transactions/transactions.controller';
import { TransactionsService } from '@/routes/transactions/transactions.service';
import { Module } from '@nestjs/common';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { DelegatesV2RepositoryModule } from '@/domain/delegate/v2/delegates.v2.repository.interface';
import { KilnVaultHelperModule } from '@/routes/transactions/helpers/kiln-vault.helper';
import { VaultTransactionMapper } from '@/routes/transactions/mappers/common/vault-transaction.mapper';
import { BridgeTransactionMapper } from '@/routes/transactions/mappers/common/bridge-transaction.mapper';
import { LiFiDecoderModule } from '@/domain/bridge/contracts/decoders/lifi-decoder.helper';
import { LiFiHelperModule } from '@/routes/transactions/helpers/lifi-helper';
import { BridgeRepositoryModule } from '@/domain/bridge/bridge.repository.module';

@Module({
  controllers: [TransactionsController],
  imports: [
    AddressInfoModule,
    BridgeRepositoryModule,
    ChainsRepositoryModule,
    ContractsRepositoryModule,
    DataDecoderRepositoryModule,
    DelegatesV2RepositoryModule,
    EarnRepositoryModule,
    GPv2DecoderModule,
    HumanDescriptionRepositoryModule,
    KilnNativeStakingHelperModule,
    KilnVaultHelperModule,
    LiFiHelperModule,
    LiFiDecoderModule,
    SafeAppsRepositoryModule,
    SafeRepositoryModule,
    StakingRepositoryModule,
    SwapAppsHelperModule,
    SwapOrderHelperModule,
    SwapOrderMapperModule,
    SwapsRepositoryModule,
    TokenRepositoryModule,
    TwapOrderHelperModule,
    TwapOrderMapperModule,
  ],
  providers: [
    BridgeTransactionMapper,
    CreationTransactionMapper,
    CustomTransactionMapper,
    DataDecodedParamHelper,
    Erc20TransferMapper,
    Erc721TransferMapper,
    GPv2OrderHelper,
    HumanDescriptionMapper,
    ModuleTransactionDetailsMapper,
    ModuleTransactionMapper,
    ModuleTransactionStatusMapper,
    MultisigTransactionDetailsMapper,
    MultisigTransactionExecutionDetailsMapper,
    MultisigTransactionExecutionInfoMapper,
    MultisigTransactionInfoMapper,
    MultisigTransactionMapper,
    MultisigTransactionNoteMapper,
    MultisigTransactionStatusMapper,
    NativeCoinTransferMapper,
    NativeStakingMapper,
    QueuedItemsMapper,
    SafeAppInfoMapper,
    SettingsChangeMapper,
    SwapTransferInfoMapper,
    TransactionDataMapper,
    TransactionPreviewMapper,
    TransactionsHistoryMapper,
    TransactionsService,
    TransactionVerifierHelper,
    TransferDetailsMapper,
    TransferImitationMapper,
    TransferInfoMapper,
    TransferMapper,
    VaultTransactionMapper,
  ],
})
export class TransactionsModule {}
