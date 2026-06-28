import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: {
    email: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
  }) {
    return this.prisma.user.create({ data });
  }

  update(
    id: string,
    data: Partial<
      Pick<User, 'email' | 'passwordHash' | 'firstName' | 'lastName'>
    >,
  ) {
    return this.prisma.user.update({ where: { id }, data });
  }
}
