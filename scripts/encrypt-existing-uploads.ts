import 'dotenv/config';
import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { uploadConfig, fileCryptoConfig } from '../src/config';
import { FileCryptoService } from '../src/common/services/file-crypto.service';

// Backfill: encrypt protected upload files (verification IDs/selfies,
// credentials) that were written as plaintext before at-rest encryption was
// enabled. Idempotent — files already carrying the encryption header are
// skipped, so it is safe to re-run. Avatars are public and left untouched.

const PROTECTED_SUBDIRS = ['verification', 'credentials'];
const DRY_RUN = process.argv.includes('--dry-run');

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

async function main(): Promise<void> {
  const { UPLOAD_ROOT } = uploadConfig();
  const crypto = new FileCryptoService(fileCryptoConfig());

  let encrypted = 0;
  let skipped = 0;

  for (const subdir of PROTECTED_SUBDIRS) {
    const files = await walk(join(UPLOAD_ROOT, subdir));
    for (const file of files) {
      const data = await readFile(file);
      if (crypto.isEncrypted(data)) {
        skipped++;
        continue;
      }
      if (!DRY_RUN) {
        await writeFile(file, crypto.encrypt(data));
      }
      encrypted++;
      console.info(
        `${DRY_RUN ? '[dry-run] would encrypt' : 'encrypted'}: ${file}`,
      );
    }
  }

  console.info(
    `\nDone. ${encrypted} ${DRY_RUN ? 'to encrypt' : 'encrypted'}, ${skipped} already encrypted.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
