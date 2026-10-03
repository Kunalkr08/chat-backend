import { Injectable } from '@nestjs/common';
import type { ChatMessage, SendMessageDto } from './chat.types.js';
import { PrismaService } from '../../prisma/prisma.service.js';

type MessageRecord = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: Date;
};

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async sendMessage(dto: SendMessageDto): Promise<ChatMessage> {
    const message = await this.prisma.message.create({
      data: {
        senderId: dto.senderId,
        receiverId: dto.receiverId,
        content: dto.content,
      },
    });

    return {
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async getMessagesBetweenUsers(
    userA: string,
    userB: string,
  ): Promise<ChatMessage[]> {
    const messages: MessageRecord[] = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userA, receiverId: userB },
          { senderId: userB, receiverId: userA },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((message: MessageRecord) => ({
      id: message.id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    }));
  }
}
