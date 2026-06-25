import { Inject, Injectable } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { textbeeConfig } from '@/config/textbee.config';

@Injectable()
export class SmsService {
    constructor(
        @Inject(textbeeConfig.KEY)
        private readonly app: ConfigType<typeof textbeeConfig>,
        private readonly logger: Logger
    ) {}

    async sendSms(phone: string, message: string) {
        console.log(`SMS to ${phone}: ${message}`)

        if(!this.app.SMS_API_KEY) {
            this.logger.log(`SMS to ${phone}: ${message}`)
        }


    }
}
