import { registerAs } from '@nestjs/config';
import { z } from 'zod';

const schema = z.object({
  UPLOAD_DIR: z.string().default('uploads'),
});

export const uploadConfig = registerAs('upload', () => {
  return schema.parse(process.env);
});
