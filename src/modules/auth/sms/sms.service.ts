import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { textbeeConfig } from '@/config/textbee.config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SmsService {
  constructor(
    @Inject(textbeeConfig.KEY)
    private readonly textbee: ConfigType<typeof textbeeConfig>,
    private readonly logger: Logger,
    private readonly http: HttpService,
  ) {}

  async sendSms(
    phone: string,
    message: string,
  ): Promise<{ status: string; messageId: string }> {
    const { TEXTBEE_API_URL, SMS_API_KEY, DEVICE_ID } = this.textbee;

    try {
      const response = await firstValueFrom(
        this.http.post(
          `${TEXTBEE_API_URL}/gateway/devices/${DEVICE_ID}/send-sms`,
          {
            recipients: [phone],
            message: message,
          },
          {
            headers: { 'x-api-key': SMS_API_KEY },
          },
        ),
      );

      this.logger.debug({ phone }, 'SMS sent successfully');
      return response.data as { status: string; messageId: string };
    } catch (err: unknown) {
      this.logger.error({ phone, err }, 'Failed to send SMS');
      throw new InternalServerErrorException('Failed to send SMS.');
    }
  }
}
