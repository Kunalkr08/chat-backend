import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { ChatService } from './chat.service.js';

type AuthenticatedRequest = Request & {
  user?: { sub: string };
};

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('messages')
  @UseGuards(JwtAccessGuard)
  getMessagesBetweenUsers(
    @Req() request: AuthenticatedRequest,
    @Query('userA') userA: string,
    @Query('userB') userB: string,
  ) {
    if (request.user?.sub !== userA && request.user?.sub !== userB) {
      throw new ForbiddenException('You are not a participant in this chat');
    }

    return this.chatService.getMessagesBetweenUsers(userA, userB);
  }
}
