import { CounterfactualSafesDatasource } from '@/datasources/accounts/counterfactual-safes/counterfactual-safes.datasource';
import { ICounterfactualSafesDatasource } from '@/domain/interfaces/counterfactual-safes.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [
    {
      provide: ICounterfactualSafesDatasource,
      useClass: CounterfactualSafesDatasource,
    },
  ],
  exports: [ICounterfactualSafesDatasource],
})
export class CounterfactualSafesDatasourceModule {}
