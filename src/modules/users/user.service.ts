import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateUserDto, LoginUserDto, User } from './user.types.js';

type DatabaseUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  createdAt: Date;
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    try {
      const passwordHash = await hash(dto.password, 12);
      const user = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          email: dto.email,
          name: dto.name,
          passwordHash,
        },
      });

      return this.toUser(user);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A user with this email already exists');
      }

      throw error;
    }
  }

  async loginUser(dto: LoginUserDto): Promise<User> {
    const user: DatabaseUser | null = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (
      !user ||
      !user.passwordHash ||
      !(await compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.toUser(user);
  }

  async getUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'asc' },
    });

    return users.map((user: DatabaseUser) => this.toUser(user));
  }

  async getUser(id: string): Promise<User> {
    const user: DatabaseUser | null = await this.prisma.user.findUnique({
      where: {
        id: id,
      },
    });

    if(!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    return this.toUser(user);
  }

  private toUser(user: {
    id: string;
    email: string;
    name: string;
    createdAt: Date;
  }): User {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
