import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  it('issues one token and verifies it', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      createdAt: '2025-01-01T00:00:00.000Z',
    };
    const jwt = {
      signAsync: vi.fn(async () => 'signed-jwt'),
      verifyAsync: vi.fn(async (token: string) => {
        if (token !== 'signed-jwt') {
          throw new Error('Invalid token');
        }

        return { sub: user.id, email: user.email, name: user.name };
      }),
    };
    const users = { loginUser: vi.fn(async () => user) };
    const config = {
      get: (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(32),
        })[key],
    };
    const service = new AuthService(
      users as any,
      jwt as any,
      config as ConfigService,
    );

    const loginResult = await service.login({
      email: user.email,
      password: 'password',
    });
    expect(loginResult.token).toBe('signed-jwt');
    expect(loginResult).not.toHaveProperty('refreshToken');
    expect(await service.verifyToken(loginResult.token)).toMatchObject({
      sub: user.id,
      email: user.email,
    });
    await expect(service.verifyToken('invalid')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
