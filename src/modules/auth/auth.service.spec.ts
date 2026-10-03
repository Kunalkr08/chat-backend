import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  const user = {
    id: 'user-1',
    email: 'user@example.com',
    name: 'User',
    createdAt: '2025-01-01T00:00:00.000Z',
  };

  const accessToken = 'signed-access-jwt';
  const refreshToken = 'signed-refresh-jwt';

  it('issues access and refresh tokens during login', async () => {
    const jwt = {
      signAsync: vi
        .fn()
        .mockResolvedValueOnce(accessToken)
        .mockResolvedValueOnce(refreshToken),

      verifyAsync: vi.fn(),
    };

    const users = {
      loginUser: vi.fn(async () => user),
    };

    const config = {
      get: (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(32),
          JWT_REFRESH_SECRET: 'r'.repeat(32),
          JWT_ACCESS_TOKEN_TTL_SECONDS: '900',
          JWT_REFRESH_TOKEN_TTL_SECONDS: '86400',
        })[key],
    };

    const service = new AuthService(
      users as any,
      jwt as any,
      config as ConfigService,
    );

    const result = await service.login({
      email: user.email,
      password: 'password',
    });

    expect(result.user).toEqual(user);
    expect(result.accessToken).toBe(accessToken);
    expect(result.refreshToken).toBe(refreshToken);

    expect(jwt.signAsync).toHaveBeenCalledTimes(2);

    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      1,
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      {
        secret: 's'.repeat(32),
        algorithm: 'HS256',
        expiresIn: 900,
      },
    );

    expect(jwt.signAsync).toHaveBeenNthCalledWith(
      2,
      {
        sub: user.id,
        type: 'refresh',
      },
      {
        secret: 'r'.repeat(32),
        algorithm: 'HS256',
        expiresIn: 86400,
      },
    );
  });

  it('verifies a valid access token', async () => {
    const jwt = {
      signAsync: vi.fn(),
      verifyAsync: vi.fn(async (token: string) => {
        if (token !== accessToken) {
          throw new Error('Invalid token');
        }

        return {
          sub: user.id,
          email: user.email,
          name: user.name,
        };
      }),
    };

    const users = {
      loginUser: vi.fn(),
    };

    const config = {
      get: (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(32),
          JWT_REFRESH_SECRET: 'r'.repeat(32),
        })[key],
    };

    const service = new AuthService(
      users as any,
      jwt as any,
      config as ConfigService,
    );

    await expect(
      service.verifyAccessToken(accessToken),
    ).resolves.toMatchObject({
      sub: user.id,
      email: user.email,
      name: user.name,
    });
  });

  it('rejects an invalid access token', async () => {
    const jwt = {
      signAsync: vi.fn(),
      verifyAsync: vi.fn(async () => {
        throw new Error('Invalid token');
      }),
    };

    const users = {
      loginUser: vi.fn(),
    };

    const config = {
      get: (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(32),
          JWT_REFRESH_SECRET: 'r'.repeat(32),
        })[key],
    };

    const service = new AuthService(
      users as any,
      jwt as any,
      config as ConfigService,
    );

    await expect(
      service.verifyAccessToken('invalid'),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('refreshes an access token using a valid refresh token', async () => {
    const newAccessToken = 'new-access-token';

    const jwt = {
      signAsync: vi.fn(async () => newAccessToken),

      verifyAsync: vi.fn(async (token: string) => {
        expect(token).toBe(refreshToken);

        return {
          sub: user.id,
          type: 'refresh',
        };
      }),
    };

    const users = {
      loginUser: vi.fn(),
      getUser: vi.fn(async () => user),
    };

    const config = {
      get: (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(32),
          JWT_REFRESH_SECRET: 'r'.repeat(32),
          JWT_ACCESS_TOKEN_TTL_SECONDS: '900',
          JWT_REFRESH_TOKEN_TTL_SECONDS: '86400',
        })[key],
    };

    const service = new AuthService(
      users as any,
      jwt as any,
      config as ConfigService,
    );

    const result = await service.refreshAccessToken(refreshToken);

    expect(result).toEqual({
      accessToken: newAccessToken,
    });

    expect(users.getUser).toHaveBeenCalledWith(user.id);

    expect(jwt.signAsync).toHaveBeenCalledWith(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      {
        secret: 's'.repeat(32),
        algorithm: 'HS256',
        expiresIn: 900,
      },
    );
  });

  it('rejects an invalid refresh token', async () => {
    const jwt = {
      signAsync: vi.fn(),

      verifyAsync: vi.fn(async () => {
        throw new Error('Invalid refresh token');
      }),
    };

    const users = {
      loginUser: vi.fn(),
      getUser: vi.fn(),
    };

    const config = {
      get: (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(32),
          JWT_REFRESH_SECRET: 'r'.repeat(32),
        })[key],
    };

    const service = new AuthService(
      users as any,
      jwt as any,
      config as ConfigService,
    );

    await expect(
      service.refreshAccessToken('invalid-refresh-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(users.getUser).not.toHaveBeenCalled();
  });

  it('rejects a token that is not a refresh token', async () => {
    const jwt = {
      signAsync: vi.fn(),

      verifyAsync: vi.fn(async () => ({
        sub: user.id,
        type: 'access',
      })),
    };

    const users = {
      loginUser: vi.fn(),
      getUser: vi.fn(),
    };

    const config = {
      get: (key: string) =>
        ({
          JWT_SECRET: 's'.repeat(32),
          JWT_REFRESH_SECRET: 'r'.repeat(32),
        })[key],
    };

    const service = new AuthService(
      users as any,
      jwt as any,
      config as ConfigService,
    );

    await expect(
      service.refreshAccessToken('wrong-type-token'),
    ).rejects.toThrow(UnauthorizedException);

    expect(users.getUser).not.toHaveBeenCalled();
  });
});
