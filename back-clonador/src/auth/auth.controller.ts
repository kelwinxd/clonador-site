import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { AuthDto } from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsuarioAutenticado } from './jwt.strategy';

/**
 * Contas (Etapa 15). Login é opcional no app: clonar e pré-visualizar são livres;
 * baixar o zip exige um destes tokens.
 * - POST /auth/register -> cria conta e devolve token
 * - POST /auth/login    -> entra e devolve token
 * - GET  /auth/me        -> quem sou eu (precisa de token)
 */
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

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
  eu(@Req() req: Request) {
    return req.user as UsuarioAutenticado;
  }
}
