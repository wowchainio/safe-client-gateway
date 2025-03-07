import { z } from 'zod';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const AddConfirmationDtoSchema = z.object({
  signature: HexSchema,
});
