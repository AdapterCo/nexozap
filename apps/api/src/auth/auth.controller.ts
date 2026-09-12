import { Controller, Post, Get, Put, Body, Param, Query, UseGuards, Request, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { CookieOptions, Response } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { IsEmail, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { Plan } from '@prisma/client';

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  companyName: string;

  @IsEnum(Plan)
  plan: Plan;

  @IsString()
  paymentMethod: 'credit_card' | 'pix';

  @IsOptional()
  @IsObject()
  cardData?: any;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.register(dto);
    if (result.token) {
      this.setAuthCookie(response, result.token);
    }
    return result;
  }

  @Get('check-registration-payment/:paymentId')
  async checkRegistrationPayment(
    @Param('paymentId') paymentId: string,
    @Query('token') token: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.checkRegistrationPayment(paymentId, token);
    if (result.token) {
      this.setAuthCookie(response, result.token);
    }
    return result;
  }

  @Put('cancel-registration-payment/:paymentId')
  async cancelRegistrationPayment(@Param('paymentId') paymentId: string, @Query('token') token: string) {
    return this.authService.cancelRegistrationPayment(paymentId, token);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    this.setAuthCookie(response, result.token);
    return { user: result.user, company: result.company };
  }

  @Post('logout')
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('nexozap_token', this.getCookieOptions());
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  private setAuthCookie(response: Response, token: string) {
    response.cookie('nexozap_token', token, {
      ...this.getCookieOptions(),
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  private getCookieOptions(): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    };

    if (process.env.NODE_ENV === 'production' && process.env.APP_URL) {
      options.domain = process.env.APP_URL;
    }

    return options;
  }
}
