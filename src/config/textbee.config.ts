import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  TEXTBEE_API_URL: z.url(),
  DEVICE_ID: z.string().min(1),
  SMS_API_KEY: z.string().min(1)
});

export const textbeeConfig = registerAs('textbee', () => {
  return schema.parse(process.env);
});