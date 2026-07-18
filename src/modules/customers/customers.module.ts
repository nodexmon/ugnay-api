import { Module } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CustomersAssertions } from './customers.assertions';
import { CustomersController } from './customers.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [CustomersService, CustomersAssertions],
})
export class CustomersModule {}
