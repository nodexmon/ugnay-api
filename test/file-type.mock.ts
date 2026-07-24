// file-type v21 is ESM-only; ts-jest (CommonJS interop) cannot resolve it.
// This mock stands in for the dynamic `import('file-type')` in
// src/common/utils/file-type.util.ts. It reports common image/PDF magic bytes
// so pipe validation exercises the happy path; unknown input returns undefined.

const SIGNATURES: { magic: number[]; ext: string; mime: string }[] = [
  { magic: [0xff, 0xd8, 0xff], ext: 'jpg', mime: 'image/jpeg' },
  { magic: [0x89, 0x50, 0x4e, 0x47], ext: 'png', mime: 'image/png' },
  { magic: [0x25, 0x50, 0x44, 0x46], ext: 'pdf', mime: 'application/pdf' },
];

export function fileTypeFromBuffer(
  buffer: Uint8Array,
): Promise<{ ext: string; mime: string } | undefined> {
  const match = SIGNATURES.find((sig) =>
    sig.magic.every((byte, i) => buffer[i] === byte),
  );
  return Promise.resolve(
    match ? { ext: match.ext, mime: match.mime } : undefined,
  );
}
