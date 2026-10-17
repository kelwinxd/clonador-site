import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CreditsService } from './credits.service';
import { AuthDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsuarioAutenticado } from './jwt.strategy';

/**
 * Contas. Login é obrigatório para clonar (cada clone gasta 1 crédito; Free tem cota mensal).
 * - POST /auth/register -> cria conta e devolve token
 * - POST /auth/login    -> entra e devolve token
 * - GET  /auth/me        -> quem sou eu + créditos do ciclo (precisa de token)
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly credits: CreditsService,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  registrar(@Body() body: AuthDto) {
    return this.auth.registrar(body.email, body.senha);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  entrar(@Body() body: AuthDto) {
    return this.auth.entrar(body.email, body.senha);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async eu(@Req() req: Request) {
    const user = req.user as UsuarioAutenticado;
    const creditos = await this.credits.estado(user.userId);
    return { ...user, creditos };
  }
}
