import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  PSGC_API_URL: z.string().url().default('https://psgc.gitlab.io/api'),
  PSGC_CALAPAN_CODE: z.string().default('175205000'),
});

export const psgcConfig = registerAs('psgc', () => {
  const env = schema.parse(process.env);
  return {
    apiUrl: env.PSGC_API_URL,
    calapanCityCode: env.PSGC_CALAPAN_CODE,
  };
});
