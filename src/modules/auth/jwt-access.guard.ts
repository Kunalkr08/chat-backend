import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service.js';

type AuthenticatedRequest = Request & {
  user?: { sub: string; email: string; name: string };
};

@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Access token required');
    }

    const token = authorization.slice(7);

    request.user = await this.auth.verifyAccessToken(token);

    return true;
  }
}