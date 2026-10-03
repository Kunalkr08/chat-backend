export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
};

export type CreateUserDto = {
  email: string;
  name: string;
  password: string;
};

export type LoginUserDto = {
  email: string;
  password: string;
};
