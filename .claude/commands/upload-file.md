Apply this checklist when adding a new endpoint that accepts file uploads.

## Interceptor choice

### Single file

```typescript
import { FileInterceptor } from '@nestjs/platform-express';
import { multerConfig } from '@/config/multer.config';

@UseInterceptors(FileInterceptor('avatar', multerConfig))
upload(
  @UploadedFile(AvatarFilePipe) file: AvatarFile,
) { ... }
```

### Multiple named fields

```typescript
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@UseInterceptors(
  FileFieldsInterceptor([
    { name: 'idPhoto', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ]),
)
upload(
  @UploadedFiles(VerificationFilesPipe) files: UploadedVerificationFiles,
) { ... }
```

`multerConfig` (`@/config/multer.config`) sets `limits.fileSize: 5MB` and uses memory storage (buffer). No mime filter at the Multer level — defer that to the pipe.

---

## Write a validation pipe

Every upload endpoint needs a dedicated pipe. Extend the pattern from `src/common/pipes/verification-files.pipe.ts` or `src/uploads/pipes/avatar-file.pipe.ts`:

```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 5 * 1024 * 1024;

@Injectable()
export class MyFilePipe implements PipeTransform {
  transform(file: AvatarFile): AvatarFile {
    if (!file) throw new BadRequestException('file is required');
    if (!ALLOWED_TYPES.includes(file.mimetype))
      throw new BadRequestException('file must be a JPEG, PNG, or WEBP image');
    if (file.size > MAX_BYTES)
      throw new BadRequestException('file must not exceed 5MB');
    return file;
  }
}
```

For credentials (where PDF is also valid), add `'application/pdf'` to `ALLOWED_TYPES`.

For multi-file pipes, iterate `REQUIRED_FIELDS` and validate `files?.[field]?.[0]` for each.

---

## Store files with FileStorageService

`FileStorageService` lives in `src/modules/workers/file-storage.service.ts` and is injected locally — not shared globally. If a new module needs it, add it to that module's `providers` and import `ConfigModule.forFeature(uploadConfig)`.

```typescript
// 1. Resolve paths (no I/O yet)
const paths = this.fileStorage.resolvePath(
  workerId,   // used in directory name
  'id-photo', // used in filename prefix
  file,       // { originalname, buffer }
  'verification', // subdir (default); use 'credentials' for credential files
);
// paths.relative → 'uploads/verification/{workerId}/id-photo-{uuid}.jpg'  ← stored in DB
// paths.absolute → full filesystem path  ← used for writeFile

// 2. Write file(s) BEFORE opening any transaction
await this.fileStorage.write(paths, file);
// For multiple files, write in parallel:
await Promise.all([
  this.fileStorage.write(idPhotoPath, idPhoto),
  this.fileStorage.write(selfiePath, selfie),
]);

// 3. Open transaction; store relative path in DB
return this.prisma.$transaction(async (tx: TransactionClient) => {
  return tx.myModel.create({ data: { fileUrl: paths.relative } });
});
```

**Why files before transaction:** a failed DB write after a file write is retryable; a missing file after a DB record is created is a silent data-quality bug. See `/add-transaction`.

---

## Type definitions

| Use case | Type | Location |
|---|---|---|
| Single image file | `AvatarFile` | `src/uploads/uploads.types.ts` |
| Worker verification pair | `UploadedVerificationFiles` | `src/modules/workers/workers.types.ts` |
| Generic file metadata | `FileMetadata` | `src/modules/workers/workers.types.ts` |

When adding a new upload type, reuse `AvatarFile` if the field shape matches (`originalname`, `mimetype`, `size`, `buffer`). Only define a new type if the shape differs.

---

## Module wiring

```typescript
@Module({
  imports: [
    PrismaModule,
    ConfigModule.forFeature(uploadConfig), // required for FileStorageService
  ],
  providers: [MyService, FileStorageService, MyAssertions],
})
export class MyModule {}
```

`UploadsModule` handles avatar uploads only. New domain-specific uploads live in their own module alongside `FileStorageService`.

---

## Rules

- File write always happens **outside and before** the Prisma transaction.
- Store only the **relative path** in the DB (e.g. `uploads/verification/...`), never the absolute path.
- Mime-type and size validation always happens in a **pipe**, never in the service.
- Always pass `multerConfig` to `FileInterceptor` — it enforces the 5MB Multer-level cap before the pipe runs.
- Register the pipe with `@UploadedFile(PipeName)` / `@UploadedFiles(PipeName)`, not as a standalone `@UsePipes()`.
