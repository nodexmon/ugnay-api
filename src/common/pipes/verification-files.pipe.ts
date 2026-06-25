import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from "@nestjs/common";
import { UploadedVerificationFiles } from "@/modules/workers/workers.types";

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024
const REQUIRED_FIELDS = ['idPhoto', 'selfie'] as const


@Injectable()
export class VerificationFilesPipe implements PipeTransform {
    transform(files: UploadedVerificationFiles) {
        for(const field of REQUIRED_FIELDS) {
            const file = files?.[field]?.[0]

            if(!file) {
                throw new BadRequestException(`${field} files is required`)
            }

            if(!ALLOWED_TYPES.includes(file.mimetype)) {
                throw new BadRequestException(`${field} file must be a JPEG, PNG, or WEBP image`)
            }

            if(file.size > MAX_BYTES) {
                throw new BadRequestException(`${field} must not exceed 5MB`)
            }
        }

        return files
    }
}