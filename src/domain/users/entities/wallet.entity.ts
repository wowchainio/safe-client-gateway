import type { z } from 'zod';
import { RowSchema } from '@/datasources/db/v1/entities/row.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { UserSchema } from '@/domain/users/entities/user.entity';

export type Wallet = z.infer<typeof WalletSchema>;

export const WalletSchema = RowSchema.extend({
  address: AddressSchema,
  user: UserSchema,
});
