import { Injectable } from '@nestjs/common';

@Injectable()
export class SmsService {
    async sendSms(phone: string, message: string) {
        console.log(`SMS to ${phone}: ${message}`)
    }
}
