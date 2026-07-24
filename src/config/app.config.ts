import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Express `trust proxy` accepts a boolean, a hop count, or a preset/IP list.
// req.ip (and therefore the OTP/SMS IP throttle) depends on this being set to
// match the real number of proxies in front of the app — see .env.example.
function parseTrustProxy(raw: string): boolean | number | string {
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  const asNumber = Number(raw);
  return Number.isInteger(asNumber) && String(asNumber) === raw
    ? asNumber
    : raw;
}

const schema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().default(3000),
  SMS_API_KEY: z.string().min(1),
  CORS_ORIGIN: z.string().optional(),
  TRUST_PROXY: z.string().default('1').transform(parseTrustProxy),
});

export const appConfig = registerAs('app', () => {
  return schema.parse(process.env);
});
