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
import { RolesGuard } from '@/modules/auth/roles.guard';
import { CategoriesModule } from '@/modules/categories/categories.module';
import { AdminModule } from '@/modules/admin/admin.module';
import { ConfigModule, ConfigType } from '@nestjs/config';
import { jwtConfig, appConfig, uploadConfig, databaseConfig, textbeeConfig } from '@/config';
import { loggerConfig } from '@/config/logger.config';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    WorkersModule,
    CustomersModule,
    CategoriesModule,
    AdminModule,

    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig, jwtConfig, uploadConfig, databaseConfig, loggerConfig, textbeeConfig
      ]
    }),

    LoggerModule.forRootAsync({
      inject: [loggerConfig.KEY],
      useFactory: (config: ConfigType<typeof loggerConfig>) => config
    })
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
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
