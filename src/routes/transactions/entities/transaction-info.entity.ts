import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TransactionInfoType {
  Bridge = 'Bridge',
  Creation = 'Creation',
  Custom = 'Custom',
  NativeStakingDeposit = 'NativeStakingDeposit',
  NativeStakingValidatorsExit = 'NativeStakingValidatorsExit',
  NativeStakingWithdraw = 'NativeStakingWithdraw',
  SettingsChange = 'SettingsChange',
  Swap = 'Swap',
  SwapAndBridge = 'SwapAndBridge',
  SwapOrder = 'SwapOrder',
  SwapTransfer = 'SwapTransfer',
  Transfer = 'Transfer',
  TwapOrder = 'TwapOrder',
  VaultDeposit = 'VaultDeposit',
  VaultRedeem = 'VaultRedeem',
}

export class TransactionInfo {
  @ApiProperty({ enum: TransactionInfoType })
  type: TransactionInfoType;
  @ApiPropertyOptional({ type: String, nullable: true })
  humanDescription: string | null;

  protected constructor(
    type: TransactionInfoType,
    humanDescription: string | null,
  ) {
    this.type = type;
    this.humanDescription = humanDescription;
  }
}
