import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../users/user.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAccessGuard } from './jwt-access.guard.js';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => UserModule)],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessGuard],
  exports: [AuthService, JwtAccessGuard],
})
export class AuthModule {}
