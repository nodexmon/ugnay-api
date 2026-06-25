import { Module } from '@nestjs/common';
import { CustomersService } from '@/modules/customers/customers.service';
import { CustomersController } from '@/modules/customers/customers.controller';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService],
})
export class CustomersModule {}
