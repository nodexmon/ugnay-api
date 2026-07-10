import { Module } from '@nestjs/common';
import { UsersService } from '@/modules/users/users.service';
import { UsersController } from '@/modules/users/users.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { UsersAssertions } from './users.assertions';

@Module({
  imports: [PrismaModule],
  controllers: [UsersController],
  providers: [UsersService, UsersAssertions],
  exports: [UsersAssertions],
})
export class UsersModule {}
