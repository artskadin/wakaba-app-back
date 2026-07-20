import { Test } from '@nestjs/testing';
import type { Response, Request } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;

  const authMock = {
    login: vi.fn(),
    register: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    getProfile: vi.fn(),
    updateProfile: vi.fn(),
  };

  const resMock = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: authMock }],
    }).compile();

    controller = module.get(AuthController);
  });

  describe('login', () => {
    it('передает креды сервису и возвращает user + accessToken без refresh', async () => {
      const dto = { email: 'a@b.c', password: 'secret' };

      authMock.login.mockResolvedValue({
        user: { id: 'u1' },
        accessToken: 'acc',
        refreshToken: 'ref',
      });

      const result = await controller.login(dto, resMock);

      expect(authMock.login).toHaveBeenCalledWith('a@b.c', 'secret');
      expect(result).toEqual({
        user: { id: 'u1' },
        accessToken: 'acc',
      });
    });

    it('кладет refreshToken в httpOnly-cookie', async () => {
      authMock.login.mockResolvedValue({
        user: {},
        accessToken: 'acc',
        refreshToken: 'ref-123',
      });

      await controller.login({ email: 'a@b.c', password: 'x' }, resMock);

      expect(resMock.cookie).toHaveBeenCalledWith(
        'refreshToken',
        'ref-123',
        expect.objectContaining({ httpOnly: true, path: '/auth' }),
      );
    });
  });

  describe('refresh', () => {
    it('бросает 401, если куки с токеном нет', async () => {
      const reqNoCookie = { cookies: {} } as Request;

      await expect(controller.refresh(reqNoCookie, resMock)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(authMock.refresh).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('без токена не дергает сервис, но куку все равно чистит', async () => {
      const reqNoCookie = { cookies: {} } as Request;

      const result = await controller.logout(reqNoCookie, resMock);

      expect(authMock.logout).not.toHaveBeenCalled();
      expect(resMock.clearCookie).toHaveBeenCalledWith('refreshToken', {
        path: '/auth',
      });
      expect(result).toEqual({ ok: true });
    });
  });
});
