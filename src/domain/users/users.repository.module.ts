import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/datasources/users/entities/users.entity.db';
import { PostgresDatabaseModuleV2 } from '@/datasources/db/v2/postgres-database.module';
import { IUsersRepository } from '@/domain/users/users.repository.interface';
import { UsersRepository } from '@/domain/users/users.repository';
import { Wallet } from '@/datasources/users/entities/wallets.entity.db';

@Module({
  imports: [PostgresDatabaseModuleV2, TypeOrmModule.forFeature([User, Wallet])],
  providers: [
    {
      provide: IUsersRepository,
      useClass: UsersRepository,
    },
  ],
  exports: [IUsersRepository],
})
export class UserRepositoryModule {}
