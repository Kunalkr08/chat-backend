import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../users/user.service.js';
import type { LoginUserDto } from '../users/user.types.js';

type TokenPayload = {
  sub: string;
  email: string;
  name: string;
};

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenTTLSeconds: number;
  private readonly refreshTokenTTLSeconds: number;

  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    config: ConfigService,
  ) {
    this.accessTokenSecret = this.getSecret(config, 'JWT_SECRET');
    this.refreshTokenSecret = this.getSecret(config, 'JWT_REFRESH_SECRET');
    this.accessTokenTTLSeconds = this.getTtl(
      config,
      'JWT_ACCESS_TOKEN_TTL_SECONDS',
      900,
    );
    this.refreshTokenTTLSeconds = this.getTtl(
      config,
      'JWT_REFRESH_TOKEN_TTL_SECONDS',
      86400,
    );
  }

  async login(dto: LoginUserDto) {
    const user = await this.users.loginUser(dto);
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, email: user.email, name: user.name },
      {
        secret: this.accessTokenSecret,
        algorithm: 'HS256',
        expiresIn: this.accessTokenTTLSeconds,
      },
    );

    const refreshToken = await this.jwt.signAsync(
      {
        sub: user.id,
        type: 'refresh',
      },
      {
        secret: this.refreshTokenSecret,
        algorithm: 'HS256',
        expiresIn: this.refreshTokenTTLSeconds,
      },
    );

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async verifyAccessToken(token: string): Promise<TokenPayload> {
    let payload: TokenPayload;

    try {
      payload = await this.jwt.verifyAsync<TokenPayload>(token, {
        secret: this.accessTokenSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return payload;
  }

  async refreshAccessToken(refreshToken: string) {
    let payload: {
      sub: string;
      type: string;
    };

    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshTokenSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.users.getUser(payload.sub);

    const accessToken = await this.jwt.signAsync(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      {
        secret: this.accessTokenSecret,
        algorithm: 'HS256',
        expiresIn: this.accessTokenTTLSeconds,
      },
    );

    return {
      accessToken,
    };
  }

  private getSecret(config: ConfigService, key: string): string {
    const secret = config.get<string>(key);

    if (!secret || secret.length < 32) {
      throw new Error(`${key} must be set to at least 32 characters`);
    }

    return secret;
  }

  private getTtl(config: ConfigService, key: string, fallback: number): number {
    const value = Number(config.get<string>(key) ?? fallback);

    if (!Number.isSafeInteger(value) || value < 1) {
      throw new Error(`${key} must be a positive integer`);
    }

    return value;
  }
}
