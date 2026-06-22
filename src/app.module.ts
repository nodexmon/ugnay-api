import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WorkersModule } from './workers/workers.module';
import { CustomersModule } from './customers/customers.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, WorkersModule, CustomersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
