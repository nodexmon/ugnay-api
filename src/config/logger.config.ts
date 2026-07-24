import { registerAs } from '@nestjs/config';
import { type Params } from 'nestjs-pino';

export const loggerConfig = registerAs('logger', (): Params => {
  const isDev = process.env.NODE_ENV !== 'production';

  return {
    pinoHttp: {
      level: isDev ? 'debug' : 'info',
      transport: {
        targets: isDev
          ? [
              {
                target: 'pino-pretty',
                level: 'debug',
                options: {
                  colorize: true,
                  singleLine: false,
                  translateTime: 'SYS:HH:MM:ss.l',
                  ignore: 'pid,hostname',
                },
              },
              {
                target: 'pino-roll',
                level: 'debug',
                options: { file: 'logs/app.log', mkdir: true },
              },
            ]
          : [
              {
                target: 'pino-roll',
                level: 'info',
                options: { file: 'logs/app.log', mkdir: true },
              },
              {
                target: 'pino-roll',
                level: 'error',
                options: { file: 'logs/error.log', mkdir: true },
              },
            ],
      },
    },
  };
});
