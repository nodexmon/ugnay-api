import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const KEY_BYTES = 32; // AES-256

const schema = z.object({
  FILE_ENCRYPTION_KEY: z.string().refine(
    (value) => {
      try {
        return Buffer.from(value, 'base64').length === KEY_BYTES;
      } catch {
        return false;
      }
    },
    { message: 'FILE_ENCRYPTION_KEY must be 32 bytes encoded as base64.' },
  ),
});

export const fileCryptoConfig = registerAs('fileCrypto', () => {
  const { FILE_ENCRYPTION_KEY } = schema.parse(process.env);
  return { key: Buffer.from(FILE_ENCRYPTION_KEY, 'base64') };
});
