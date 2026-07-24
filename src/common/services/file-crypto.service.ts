import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import type { ConfigType } from '@nestjs/config';
import { fileCryptoConfig } from '@/config';

// On-disk format: MAGIC | VERSION | IV | AUTH_TAG | CIPHERTEXT.
// The magic prefix lets the read path tell encrypted files apart from legacy
// plaintext written before encryption was enabled.
const MAGIC = Buffer.from('UENC', 'ascii');
const VERSION = 1;
const IV_LENGTH = 12; // AES-GCM standard nonce
const AUTH_TAG_LENGTH = 16;
const HEADER_LENGTH = MAGIC.length + 1 + IV_LENGTH + AUTH_TAG_LENGTH;

@Injectable()
export class FileCryptoService {
  constructor(
    @Inject(fileCryptoConfig.KEY)
    private readonly config: ConfigType<typeof fileCryptoConfig>,
  ) {}

  encrypt(plaintext: Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.config.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    return Buffer.concat([
      MAGIC,
      Buffer.from([VERSION]),
      iv,
      cipher.getAuthTag(),
      ciphertext,
    ]);
  }

  isEncrypted(data: Buffer): boolean {
    return (
      data.length >= HEADER_LENGTH &&
      data.subarray(0, MAGIC.length).equals(MAGIC)
    );
  }

  decrypt(data: Buffer): Buffer {
    // Legacy plaintext (pre-encryption) is returned untouched.
    if (!this.isEncrypted(data)) {
      return data;
    }

    let offset = MAGIC.length + 1; // skip magic + version
    const iv = data.subarray(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    const authTag = data.subarray(offset, offset + AUTH_TAG_LENGTH);
    offset += AUTH_TAG_LENGTH;
    const ciphertext = data.subarray(offset);

    const decipher = createDecipheriv('aes-256-gcm', this.config.key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }
}
