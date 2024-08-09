import { AccountsDatasourceModule } from '@/datasources/accounts/accounts.datasource.module';
import { NotificationsDatasource } from '@/datasources/notifications/notifications.datasource';
import { INotificationsDatasource } from '@/domain/interfaces/notifications.datasource.interface';
import { Module } from '@nestjs/common';

@Module({
  imports: [AccountsDatasourceModule],
  providers: [
    { provide: INotificationsDatasource, useClass: NotificationsDatasource },
  ],
  exports: [INotificationsDatasource],
})
export class NotificationsDatasourceModule {}
