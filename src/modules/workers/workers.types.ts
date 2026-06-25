type VerificationFilesMetadata = FileMetadata & {
    mimetype: string
}

export type FileMetadata = {
    originalname : string, 
    buffer: Buffer,
    size: number
}


export type UploadedVerificationFiles = {
    idPhoto: VerificationFilesMetadata[];
    selfie: VerificationFilesMetadata[]
}

