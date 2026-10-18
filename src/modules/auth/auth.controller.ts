import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';

import type { Response, Request } from 'express';
import { AuthService } from './auth.service.js';
import { JwtAccessGuard } from './jwt-access.guard.js';
import { envConfig } from '../../config/env.config.js';
import {
  LoginDto,
  RegisterDto,
  VerifyEmailDto,
} from './auth.types.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Register a new user and send the OTP.
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // Verify the four-digit OTP.
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(
      dto.email,
      dto.otp,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: envConfig.nodeEnv === 'production',
      sameSite:
        envConfig.nodeEnv === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() request: Request) {
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException(
        'Refresh token required',
      );
    }

    const result =
      await this.authService.refreshAccessToken(refreshToken);

    return {
      accessToken: result.accessToken,
    };
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  getCurrentUser(
    @Req()
    request: Request & {
      user?: {
        sub: string;
        email: string;
        name: string;
      };
    },
  ) {
    return {
      id: request.user?.sub,
      email: request.user?.email,
      name: request.user?.name,
      createdAt: null,
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Res({ passthrough: true }) response: Response,
  ) {
    response.clearCookie('refreshToken', {
      httpOnly: true,
      secure: envConfig.nodeEnv === 'production',
      sameSite:
        envConfig.nodeEnv === 'production' ? 'none' : 'lax',
      path: '/',
    });

    return {
      message: 'Logged out successfully',
    };
  }
}
