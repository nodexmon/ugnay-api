import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'nestjs-pino';
import { of, throwError } from 'rxjs';
import { textbeeConfig } from '@/config/textbee.config';
import { SmsService } from '@/modules/auth/sms/sms.service';

describe('SmsService', () => {
  let service: SmsService;

  const http = {
    post: jest.fn(),
  };

  const logger = {
    debug: jest.fn(),
    error: jest.fn(),
  };

  const config = {
    TEXTBEE_API_URL: 'https://api.textbee.dev/api/v1',
    DEVICE_ID: 'device-id',
    SMS_API_KEY: 'api-key',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: textbeeConfig.KEY, useValue: config },
        { provide: Logger, useValue: logger },
        { provide: HttpService, useValue: http },
      ],
    }).compile();

    service = module.get<SmsService>(SmsService);
  });

  describe('sendSms', () => {
    it('returns status and messageId on success', async () => {
      const responseData = { status: 'sent', messageId: 'message-id' };
      http.post.mockReturnValue(of({ data: responseData }));

      const result = await service.sendSms(
        '+639171234567',
        'Your OTP is 123456',
      );

      expect(http.post).toHaveBeenCalledWith(
        'https://api.textbee.dev/api/v1/gateway/devices/device-id/send-sms',
        { recipients: ['+639171234567'], message: 'Your OTP is 123456' },
        { headers: { 'x-api-key': 'api-key' } },
      );
      expect(logger.debug).toHaveBeenCalledWith('SMS sent successfully');
      expect(result).toEqual(responseData);
    });

    it('throws ServiceUnavailableException when the HTTP request fails', async () => {
      http.post.mockReturnValue(throwError(() => new Error('Network error')));

      await expect(
        service.sendSms('+639171234567', 'Your OTP is 123456'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
