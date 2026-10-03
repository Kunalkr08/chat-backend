export type ChatMessage = {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: string;
};

export type SendMessageDto = {
  senderId: string;
  receiverId: string;
  content: string;
};
