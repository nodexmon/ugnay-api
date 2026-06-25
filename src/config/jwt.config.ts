import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
});

export const jwtConfig = registerAs('jwt', () => {
  return schema.parse(process.env);
});