import { Test, TestingModule } from '@nestjs/testing';
import { Role } from '@/generated/prisma/enums';
import { AuthController } from '@/modules/auth/auth.controller';
import { AuthService } from '@/modules/auth/auth.service';
import type { AuthJwtPayload } from '@/modules/auth/auth.types';

const user: AuthJwtPayload = { sub: 'user-id', role: Role.WORKER };

describe('AuthController', () => {
  let controller: AuthController;

  const authService = {
    sendOtp: jest.fn(),
    verifyOtp: jest.fn(),
    register: jest.fn(),
    refreshToken: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllSessions: jest.fn(),
    getAllSessions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('sendOtp', () => {
    it('delegates to authService.sendOtp with the phone number', async () => {
      authService.sendOtp.mockResolvedValue({ message: 'OTP sent.' });

      const result = await controller.sendOtp({ phone: '+639171234567' });

      expect(authService.sendOtp).toHaveBeenCalledWith('+639171234567');
      expect(result).toEqual({ message: 'OTP sent.' });
    });
  });

  describe('verifyOtp', () => {
    it('delegates to authService.verifyOtp with phone and code', async () => {
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      authService.verifyOtp.mockResolvedValue(tokens);

      const result = await controller.verifyOtp({
        phone: '+639171234567',
        code: '123456',
      });

      expect(authService.verifyOtp).toHaveBeenCalledWith(
        '+639171234567',
        '123456',
      );
      expect(result).toEqual(tokens);
    });
  });

  describe('register', () => {
    it('delegates to authService.register with token and role', async () => {
      const tokens = { accessToken: 'access', refreshToken: 'refresh' };
      authService.register.mockResolvedValue(tokens);

      const result = await controller.register({
        registrationToken: 'reg-token',
        role: Role.WORKER,
      });

      expect(authService.register).toHaveBeenCalledWith(
        'reg-token',
        Role.WORKER,
      );
      expect(result).toEqual(tokens);
    });
  });

  describe('refreshToken', () => {
    it('delegates to authService.refreshToken', async () => {
      const tokens = { accessToken: 'new-access', refreshToken: 'new-refresh' };
      authService.refreshToken.mockResolvedValue(tokens);

      const result = await controller.refreshToken({
        refreshToken: 'old-refresh',
      });

      expect(authService.refreshToken).toHaveBeenCalledWith('old-refresh');
      expect(result).toEqual(tokens);
    });
  });

  describe('revokeSession', () => {
    it('calls authService.revokeSession and returns a confirmation message', async () => {
      authService.revokeSession.mockResolvedValue(undefined);

      const result = await controller.revokeSession(user, 'token-id');

      expect(authService.revokeSession).toHaveBeenCalledWith(
        'user-id',
        'token-id',
      );
      expect(result).toEqual({ message: 'Session revoked.' });
    });
  });

  describe('revokeAllSessions', () => {
    it('calls authService.revokeAllSessions and returns a confirmation message', async () => {
      authService.revokeAllSessions.mockResolvedValue(undefined);

      const result = await controller.revokeAllSessions(user);

      expect(authService.revokeAllSessions).toHaveBeenCalledWith('user-id');
      expect(result).toEqual({ message: 'All sessions revoked.' });
    });
  });

  describe('getSessions', () => {
    it('delegates to authService.getAllSessions', async () => {
      const sessions = [{ id: 'session-1' }];
      authService.getAllSessions.mockResolvedValue(sessions);

      const result = await controller.getSessions(user);

      expect(authService.getAllSessions).toHaveBeenCalledWith('user-id');
      expect(result).toEqual(sessions);
    });
  });
});
