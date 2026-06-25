import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { Logger } from 'nestjs-pino';
import { of } from 'rxjs';
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

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('sends an SMS through TextBee', async () => {
    const response = { data: { messageId: 'message-id' } };
    http.post.mockReturnValue(of(response));

    await expect(
      service.sendSms('+639171234567', 'Your OTP is 123456'),
    ).resolves.toEqual(response.data);
    expect(http.post).toHaveBeenCalledWith(
      'https://api.textbee.dev/api/v1/gateway/devices/device-id/send-sms',
      {
        recipients: ['+639171234567'],
        message: 'Your OTP is 123456',
      },
      {
        headers: { 'x-api-key': 'api-key' },
      },
    );
    expect(logger.debug).toHaveBeenCalledWith(
      { phone: '+639171234567' },
      'SMS sent successfully',
    );
  });
});
