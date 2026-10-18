import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { compare, hash } from 'bcryptjs';

import { PrismaService } from '../../prisma/prisma.service.js';
import type { CreateUserDto, LoginUserDto, User } from './user.types.js';

type DatabaseUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  isEmailVerified: boolean;
  createdAt: Date;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);
  constructor(private readonly prisma: PrismaService) {}

  async createUser(dto: CreateUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();

    try {
      const passwordHash = await hash(dto.password, 12);

      const user = await this.prisma.user.create({
        data: {
          id: randomUUID(),
          email,
          name: dto.name,
          passwordHash,
          isEmailVerified: false,
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

  async createUserWithEmailVerification(
    dto: CreateUserDto,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<User> {
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await hash(dto.password, 12);

    this.logger.log(`Starting registration transaction for ${email}`);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            id: randomUUID(),
            email,
            name: dto.name,
            passwordHash,
            isEmailVerified: false,
          },
        });

        await tx.emailVerification.create({
          data: {
            userId: createdUser.id,
            tokenHash,
            expiresAt,
          },
        });

        return createdUser;
      });

      this.logger.log(`Registration transaction committed for ${email}`);

      return this.toUser(user);
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        this.logger.warn(`Registration rejected: duplicate email ${email}`);

        throw new ConflictException('A user with this email already exists');
      }

      this.logger.error(
        `Registration transaction failed for ${email}`,
        error instanceof Error ? error.stack : String(error),
      );

      throw error;
    }
  }

  async loginUser(dto: LoginUserDto): Promise<User> {
    const email = dto.email.trim().toLowerCase();

    const user: DatabaseUser | null = await this.prisma.user.findUnique({
      where: { email },
    });

    if (
      !user ||
      !user.passwordHash ||
      !(await compare(dto.password, user.passwordHash))
    ) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Please verify your email before logging in',
      );
    }

    return this.toUser(user);
  }

  async verifyEmail(email: string, otpHash: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || user.isEmailVerified) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const record = await this.prisma.emailVerification.findUnique({
      where: { userId: user.id },
    });

    if (!record) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    if (record.expiresAt <= new Date()) {
      await this.prisma.emailVerification.deleteMany({
        where: { id: record.id },
      });

      throw new UnauthorizedException('Invalid or expired OTP');
    }

    const storedHash = Buffer.from(record.tokenHash, 'hex');
    const suppliedHash = Buffer.from(otpHash, 'hex');

    const matches =
      storedHash.length === suppliedHash.length &&
      timingSafeEqual(storedHash, suppliedHash);

    if (!matches) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { isEmailVerified: true },
      });

      // Consume the OTP after successful verification.
      await tx.emailVerification.delete({
        where: { id: record.id },
      });
    });
  }

  // Return only verified users.
  async getUsers(): Promise<User[]> {
    const users = await this.prisma.user.findMany({
      where: {
        isEmailVerified: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return users.map((user) => this.toUser(user));
  }

  // Retrieve one user only if they exist and are verified.
  async getUser(id: string): Promise<User> {
    const user: DatabaseUser | null = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }

    if (!user.isEmailVerified) {
      throw new ForbiddenException(
        'Please verify your email before continuing',
      );
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

  async findUserByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase(),
      },
    });
  }
}
