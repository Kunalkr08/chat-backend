import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomInt, createHmac } from 'node:crypto';

import { UserService } from '../users/user.service.js';
import { EmailService } from '../../email/email.service.js';

import type { CreateUserDto, LoginUserDto } from '../users/user.types.js';

type TokenPayload = {
  sub: string;
  email: string;
  name: string;
};

@Injectable()
export class AuthService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly otpHashSecret: string;
  private readonly accessTokenTTLSeconds: number;
  private readonly refreshTokenTTLSeconds: number;
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserService,
    private readonly jwt: JwtService,
    private readonly emailService: EmailService,
    config: ConfigService,
  ) {
    this.accessTokenSecret = this.getSecret(config, 'JWT_SECRET');

    this.refreshTokenSecret = this.getSecret(config, 'JWT_REFRESH_SECRET');

    this.otpHashSecret = this.getSecret(config, 'OTP_HASH_SECRET');

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

  async register(dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const userCheck = await this.users.findUserByEmail(email);

    if (userCheck) {
      throw new ConflictException('A user with this email already exists.');
    }

    this.logger.log(`Registration requested for ${email}`);

    // Generate the OTP and its expiry.
    const otp = randomInt(1000, 10000).toString();
    const otpHash = this.hashOtp(email, otp);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Create user + OTP record atomically.
    const user = await this.users.createUserWithEmailVerification(
      {
        ...dto,
        email,
      },
      otpHash,
      expiresAt,
    );

    this.logger.log(
      `User created successfully; attempting verification email for ${email}`,
    );

    // SMTP is external to the database transaction.
    try {
      await this.emailService.sendVerificationEmail(user.email, otp);

      this.logger.log(`Verification email sent successfully to ${email}`);
    } catch (error) {
      const err = error instanceof Error ? error : undefined;

      this.logger.error(
        `Verification email delivery failed for ${email}. ` +
          `Error: ${err?.message ?? String(error)}`,
        err?.stack,
      );

      throw new ServiceUnavailableException(
        'Your account was created, but the verification email could not be sent. Please try again later or request a new verification code.',
      );
    }

    return {
      message:
        'Account created. Enter the OTP sent to your email to verify your account.',
    };
  }

  async verifyEmail(email: string, otp: string) {
    if (
      typeof email !== 'string' ||
      !email.trim() ||
      typeof otp !== 'string' ||
      !/^\d{4}$/.test(otp)
    ) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    // Hash the supplied OTP before passing it to UserService.
    const otpHash = this.hashOtp(email, otp);

    // Both required arguments are passed here.
    await this.users.verifyEmail(email, otpHash);

    return {
      message: 'Email verified successfully. You can now log in.',
    };
  }

  async login(dto: LoginUserDto) {
    // Reject unverified users before issuing tokens.
    const user = await this.users.loginUser(dto);

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

    return { user, accessToken, refreshToken };
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
    let payload: { sub: string; type: string };

    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.refreshTokenSecret,
        algorithms: ['HS256'],
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!payload.sub || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // getUser checks existence and email verification.
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

    return { accessToken };
  }

  private hashOtp(email: string, otp: string): string {
    return createHmac('sha256', this.otpHashSecret)
      .update(`${email.trim().toLowerCase()}:${otp}`)
      .digest('hex');
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
