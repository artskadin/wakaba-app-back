import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { type Response, type Request } from 'express';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import { type AuthUser } from './auth.types';

const REFRESH_COOKIE = 'refreshToken';
const refreshCookieOptions = {
  httpOnly: true,
  secure: false,
  sameSite: 'lax' as const,
  path: '/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto.email, dto.password);
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, accessToken, refreshToken } = await this.auth.login(
      dto.email,
      dto.password,
    );

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    return { user, accessToken };
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!token) {
      throw new UnauthorizedException('Refresh token not found');
    }

    const { accessToken, refreshToken } = await this.auth.refresh(token);

    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions);

    return { accessToken };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (token) {
      await this.auth.logout(token);
    }

    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });

    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getProfile(user.id);
  }
}
