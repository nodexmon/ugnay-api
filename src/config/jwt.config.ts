import { registerAs } from '@nestjs/config';
import { type StringValue } from 'ms';
import { z } from 'zod';

const schema = z.object({
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().min(1).default('7d'),
  JWT_REGISTRATION_EXPIRES_IN: z.string().min(1).default('15m'),
});

export const jwtConfig = registerAs('jwt', () => {
  const env = schema.parse(process.env);

  return {
    ...env,
    JWT_ACCESS_EXPIRES_IN: env.JWT_ACCESS_EXPIRES_IN as StringValue,
    JWT_REFRESH_EXPIRES_IN: env.JWT_REFRESH_EXPIRES_IN as StringValue,
    JWT_REGISTRATION_EXPIRES_IN: env.JWT_REGISTRATION_EXPIRES_IN as StringValue,
  };
});
