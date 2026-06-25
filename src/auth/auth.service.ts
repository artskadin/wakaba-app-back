import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsersService } from 'src/users/users.service';

const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private users: UsersService,
    private jwt: JwtService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}
  async register(email: string, password: string) {
    const existing = await this.users.findByEmail(email);

    if (existing) {
      throw new ConflictException('This email is already in use');
    }

    const passwordHash = await argon2.hash(password);
    const user = await this.users.create(email, passwordHash);

    return { id: user.id, email: user.email };
  }

  async refresh(token: string) {
    let payload: { sub: string; jti: string };

    try {
      payload = await this.jwt.verifyAsync(token, {
        secret: this.config.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    if (!stored) {
      throw new UnauthorizedException('Session not found');
    }

    const matches = await argon2.verify(stored.tokenHash, token);
    if (!matches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: payload.jti } });

    const user = await this.users.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }

    return this.issueTokens(user.id, user.email);
  }

  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      ...tokens,
    };
  }

  async logout(token: string) {
    const payload = this.jwt.decode<{ jti?: string } | null>(token);
    if (payload?.jti) {
      await this.prisma.refreshToken.deleteMany({ where: { id: payload.jti } });
    }
  }

  private async issueTokens(userId: string, email: string) {
    const jti = randomUUID();

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL'),
      },
    );

    const refreshToken = await this.jwt.signAsync(
      { sub: userId, jti },
      {
        secret: this.config.get('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_TTL'),
      },
    );

    const tokenHash = await argon2.hash(refreshToken);
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        tokenHash,
        userId,
        expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  async getProfile(userId: string) {
    const user = await this.users.findById(userId);

    if (!user) {
      throw new UnauthorizedException();
    }

    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }
}
