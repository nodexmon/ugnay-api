import { IsIn, IsNotEmpty, IsString } from 'class-validator';
import { Role } from '@/generated/prisma/enums';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  registrationToken: string;

  @IsIn([Role.CUSTOMER, Role.WORKER])
  role: Role;
}
