import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url({
    protocol: /^(postgres|postgresql)$/,
  }),
});

export const databaseConfig = registerAs('database', () => {
  return schema.parse(process.env);
});
