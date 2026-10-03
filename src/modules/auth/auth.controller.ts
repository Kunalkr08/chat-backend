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

import type { Response } from 'express';

import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

import { AuthService } from './auth.service.js';

import type { LoginUserDto } from '../users/user.types.js';
import { JwtAccessGuard } from './jwt-access.guard.js';
import type { Request } from 'express';

class LoginDto implements LoginUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto);

    response.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: 'none',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return {
      user: result.user,
      accessToken: result.accessToken,
    };
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
  ) {
    const refreshToken = request.cookies?.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token required');
    }

    const result = await this.authService.refreshAccessToken(refreshToken);

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
}
