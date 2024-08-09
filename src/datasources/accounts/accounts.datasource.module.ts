import { Module } from '@nestjs/common';
import { AccountsDatasource } from '@/datasources/accounts/accounts.datasource';
import { IAccountsDatasource } from '@/domain/interfaces/accounts.datasource.interface';

@Module({
  imports: [],
  providers: [{ provide: IAccountsDatasource, useClass: AccountsDatasource }],
  exports: [IAccountsDatasource],
})
export class AccountsDatasourceModule {}
