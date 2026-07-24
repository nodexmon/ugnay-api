import { Test, TestingModule } from '@nestjs/testing';
import { FileCryptoService } from './file-crypto.service';
import { fileCryptoConfig } from '@/config';

const key = Buffer.alloc(32, 7);

describe('FileCryptoService', () => {
  let service: FileCryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileCryptoService,
        { provide: fileCryptoConfig.KEY, useValue: { key } },
      ],
    }).compile();

    service = module.get<FileCryptoService>(FileCryptoService);
  });

  it('round-trips plaintext through encrypt/decrypt', () => {
    const plaintext = Buffer.from('sensitive id photo bytes');
    const encrypted = service.encrypt(plaintext);

    expect(encrypted.subarray(0, 4).toString('ascii')).toBe('UENC');
    expect(service.isEncrypted(encrypted)).toBe(true);
    expect(encrypted.equals(plaintext)).toBe(false);
    expect(service.decrypt(encrypted).equals(plaintext)).toBe(true);
  });

  it('uses a fresh nonce per encryption', () => {
    const plaintext = Buffer.from('same input');

    expect(service.encrypt(plaintext).equals(service.encrypt(plaintext))).toBe(
      false,
    );
  });

  it('passes legacy plaintext through decrypt untouched', () => {
    const legacy = Buffer.from('plain-jpeg-bytes');

    expect(service.isEncrypted(legacy)).toBe(false);
    expect(service.decrypt(legacy).equals(legacy)).toBe(true);
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = service.encrypt(Buffer.from('secret'));
    encrypted[encrypted.length - 1] ^= 0xff;

    expect(() => service.decrypt(encrypted)).toThrow();
  });
});
