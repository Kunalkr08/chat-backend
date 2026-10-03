import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatService } from './chat.service.js';

@Module({
  controllers: [ChatController],
  imports: [AuthModule],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
