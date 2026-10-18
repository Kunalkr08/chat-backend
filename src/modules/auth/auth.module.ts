import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../users/user.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAccessGuard } from './jwt-access.guard.js';
import { EmailModule } from '../../email/email.module.js';

@Module({
  imports: [JwtModule.register({}), forwardRef(() => UserModule), EmailModule,],
  controllers: [AuthController],
  providers: [AuthService, JwtAccessGuard],
  exports: [AuthService, JwtAccessGuard],
})
export class AuthModule {}
