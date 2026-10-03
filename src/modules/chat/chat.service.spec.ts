import { ChatService } from './chat.service.js';

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(() => {
    const prismaMock = {
      message: {
        create: async ({
          data,
        }: {
          data: { senderId: string; receiverId: string; content: string };
        }) => ({
          id: 'msg-1',
          senderId: data.senderId,
          receiverId: data.receiverId,
          content: data.content,
          createdAt: new Date('2025-01-01T00:00:01.000Z'),
        }),
        findMany: async () => [
          {
            id: 'msg-1',
            senderId: 'user-1',
            receiverId: 'user-2',
            content: 'Hey Bob!',
            createdAt: new Date('2025-01-01T00:00:01.000Z'),
          },
        ],
      },
    };

    service = new ChatService(prismaMock as any);
  });

  it('should send a direct message and retrieve the direct chat history', async () => {
    const message = await service.sendMessage({
      senderId: 'user-1',
      receiverId: 'user-2',
      content: 'Hey Bob!',
    });

    expect(message.content).toBe('Hey Bob!');
    expect(
      await service.getMessagesBetweenUsers('user-1', 'user-2'),
    ).toHaveLength(1);
  });
});
