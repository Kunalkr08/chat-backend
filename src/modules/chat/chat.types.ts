export type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
  readAt: string | null;
};

export type SendMessageDto = {
  senderId: string;
  receiverId: string;
  content: string;
};
