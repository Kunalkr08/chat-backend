import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAccessGuard } from '../auth/jwt-access.guard.js';
import { UserService } from './user.service.js';
import type { CreateUserDto, LoginUserDto } from './user.types.js';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  createUser(@Body() dto: CreateUserDto) {
    return this.userService.createUser(dto);
  }

  @Get()
  @UseGuards(JwtAccessGuard)
  getUsers() {
    return this.userService.getUsers();
  }
}
