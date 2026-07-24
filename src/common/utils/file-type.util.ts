// file-type v21+ ships as ESM-only. The Nest build compiles to CommonJS, so the
// package cannot be `import`ed statically at module-load time — it must be pulled
// in with a dynamic `import()`, which Node resolves as real ESM. The resolved
// function is cached after the first call.

export interface DetectedFileType {
  ext: string;
  mime: string;
}

type FileTypeFromBuffer = (
  buffer: Uint8Array,
) => Promise<DetectedFileType | undefined>;

let cachedFileTypeFromBuffer: FileTypeFromBuffer | undefined;

export async function detectFileType(
  buffer: Uint8Array,
): Promise<DetectedFileType | undefined> {
  if (!cachedFileTypeFromBuffer) {
    ({ fileTypeFromBuffer: cachedFileTypeFromBuffer } =
      await import('file-type'));
  }
  return cachedFileTypeFromBuffer(buffer);
}
