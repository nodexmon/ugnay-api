import { Module } from '@nestjs/common';
import { AppController } from '@/app.controller';
import { AppService } from '@/app.service';
import { PrismaModule } from '@/prisma/prisma.module';
import { AuthModule } from '@/modules/auth/auth.module';
import { UsersModule } from '@/modules/users/users.module';
import { WorkersModule } from '@/modules/workers/workers.module';
import { CustomersModule } from '@/modules/customers/customers.module';
import { APP_GUARD } from '@nestjs/core';
import { JwtAuthGuard } from '@/modules/auth/auth.guard';
import { CaslGuard } from '@/casl/casl.guard';
import { CaslModule } from '@/casl/casl.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import {
  jwtConfig,
  appConfig,
  uploadConfig,
  databaseConfig,
  textbeeConfig,
} from '@/config';
import { loggerConfig } from '@/config/logger.config';
import { LoggerModule } from 'nestjs-pino';
import { HttpModule } from '@nestjs/axios';
import { BookingsModule } from './modules/bookings/bookings.module';
import { ScheduleModule } from '@nestjs/schedule';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { BarangaysModule } from './modules/barangays/barangays.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkersModule,
    CustomersModule,
    CategoriesModule,
    AdminModule,
    BookingsModule,
    ReviewsModule,
    NotificationsModule,
    BarangaysModule,
    CaslModule,

    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        jwtConfig,
        uploadConfig,
        databaseConfig,
        loggerConfig,
        textbeeConfig,
      ],
    }),

    LoggerModule.forRootAsync({
      inject: [loggerConfig.KEY],
      useFactory: (config: ConfigType<typeof loggerConfig>) => config,
    }),

    ScheduleModule.forRoot(),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),

    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CaslGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
