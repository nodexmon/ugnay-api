import { execSync } from 'child_process';
import { config } from 'dotenv';
import path from 'path';

export default async function globalSetup() {
  config({ path: path.resolve(process.cwd(), '.env.test'), override: true });
  execSync('pnpm prisma migrate deploy', { stdio: 'inherit' });
}
