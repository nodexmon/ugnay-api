import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  SMS_API_KEY: z.string().min(1),
});

export const appConfig = registerAs('app', () => {
  return schema.parse(process.env);
});
