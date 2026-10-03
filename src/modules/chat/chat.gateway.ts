import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service.js';
import { ChatService } from './chat.service.js';
import type { SendMessageDto } from './chat.types.js';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly connectedUsers = new Map<string, string>();

  constructor(
    private readonly chatService: ChatService,
    private readonly authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    // const authToken = client.handshake.auth?.token as string | undefined;
    // const authorization = client.handshake.headers.authorization;
    // const headerToken = authorization?.startsWith('Bearer ')
    //   ? authorization.slice(7)
    //   : undefined;

    // try {
    //   client.data.user = await this.authService.verifyToken(
    //     authToken ?? headerToken ?? '',
    //   );
    // } catch {
    //   client.disconnect(true);
    //   return;
    // }

    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('join_chat')
  joinChat(@ConnectedSocket() client: Socket, @MessageBody() payload: { userId: string },) {
    // const userId = this.getAuthenticatedUserId(client);
    const userId = payload.userId;

    if (!userId) {
      client.emit('auth_error', { message: 'Valid access token required' });
      client.disconnect(true);
      return;
    }

    this.connectedUsers.set(userId, client.id);

    client.emit('joined_chat', {
      userId,
    });
  }

  @SubscribeMessage('send_message')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawPayload: SendMessageDto,
  ) {
    // const senderId = this.getAuthenticatedUserId(client);
    const senderId = rawPayload?.senderId;

    if (!senderId) {
      client.emit('auth_error', { message: 'Valid access token required' });
      client.disconnect(true);
      return;
    }

    let payload: SendMessageDto;

    try {
      payload =
        typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    } catch {
      client.emit('message_error', {
        message: 'Invalid JSON payload',
      });
      return;
    }

    if (!payload.receiverId || !payload.content) {
      client.emit('message_error', {
        message: 'receiverId and content are required',
      });
      return;
    }

    const chatMessage = await this.chatService.sendMessage({
      senderId,
      receiverId: payload.receiverId,
      content: payload.content,
    });

    this.server.to(client.id).emit('new_message', chatMessage);

    const receiverSocketId = this.connectedUsers.get(payload.receiverId);

    if (receiverSocketId && receiverSocketId !== client.id) {
      this.server.to(receiverSocketId).emit('new_message', chatMessage);
    }

    return chatMessage;
  }

  private getAuthenticatedUserId(client: Socket): string | undefined {
    return client.data.user?.sub as string | undefined;
  }
}
