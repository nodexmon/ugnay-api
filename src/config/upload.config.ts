import { registerAs } from '@nestjs/config';
import { isAbsolute, join } from 'path';
import { z } from 'zod';

const schema = z.object({
  // Logical prefix embedded in stored file URLs (e.g. `uploads/verification/…`)
  // and the `/uploads` route. Kept separate from the physical location so the
  // on-disk root can move without rewriting persisted URLs.
  UPLOAD_DIR: z.string().default('uploads'),
  // Absolute (or cwd-relative) directory where files physically live. Defaults
  // to `<cwd>/<UPLOAD_DIR>`; point it at a restricted volume outside the deploy
  // directory in production.
  UPLOAD_ROOT: z.string().optional(),
});

export const uploadConfig = registerAs('upload', () => {
  const env = schema.parse(process.env);

  const resolvedRoot = env.UPLOAD_ROOT
    ? isAbsolute(env.UPLOAD_ROOT)
      ? env.UPLOAD_ROOT
      : join(process.cwd(), env.UPLOAD_ROOT)
    : join(process.cwd(), env.UPLOAD_DIR);

  return {
    UPLOAD_DIR: env.UPLOAD_DIR,
    UPLOAD_ROOT: resolvedRoot,
  };
});
