type VerificationFilesMetadata = FileMetadata & {
  mimetype: string;
};

export interface FileMetadata {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface UploadedVerificationFiles {
  idPhoto: VerificationFilesMetadata[];
  selfie: VerificationFilesMetadata[];
}
