import { IsEnum } from 'class-validator';
import { CredentialType } from '@/generated/prisma/enums';

export class UploadCredentialDto {
  @IsEnum(CredentialType)
  type: CredentialType;
}
