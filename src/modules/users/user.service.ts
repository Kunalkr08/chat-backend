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

  async prepareEmailVerificationResend(
    email: string,
    tokenHash: string,
    expiresAt: Date,
    cooldownSeconds: number,
  ) {
    const normalizedEmail = email.trim().toLowerCase();

    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { email: normalizedEmail },
          include: { emailVerification: true },
        });

        if (!user || user.isEmailVerified) {
          return {
            state: 'unavailable' as const,
            retryAfterSeconds: cooldownSeconds,
          };
        }

        const now = new Date();
        const record = user.emailVerification;

        if (record) {
          const retryAfterSeconds = Math.ceil(
            (record.createdAt.getTime() + cooldownSeconds * 1000 -
              now.getTime()) /
              1000,
          );

          if (retryAfterSeconds > 0) {
            return { state: 'cooldown' as const, retryAfterSeconds };
          }

          // The timestamp predicate makes simultaneous resend requests compete
          // for the same OTP rotation; only one request can send a new code.
          const updated = await tx.emailVerification.updateMany({
            where: {
              userId: user.id,
              createdAt: record.createdAt,
            },
            data: {
              tokenHash,
              expiresAt,
              createdAt: now,
            },
          });

          if (updated.count === 0) {
            const latest = await tx.emailVerification.findUnique({
              where: { userId: user.id },
              select: { createdAt: true },
            });
            const retryAfterSeconds = latest
              ? Math.max(
                  1,
                  Math.ceil(
                    (latest.createdAt.getTime() +
                      cooldownSeconds * 1000 -
                      now.getTime()) /
                      1000,
                  ),
                )
              : cooldownSeconds;

            return { state: 'cooldown' as const, retryAfterSeconds };
          }
        } else {
          await tx.emailVerification.create({
            data: {
              userId: user.id,
              tokenHash,
              expiresAt,
              createdAt: now,
            },
          });
        }

        return {
          state: 'prepared' as const,
          retryAfterSeconds: cooldownSeconds,
        };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return {
          state: 'cooldown' as const,
          retryAfterSeconds: cooldownSeconds,
        };
      }

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
      include: { emailVerification: true },
    });
  }
}
