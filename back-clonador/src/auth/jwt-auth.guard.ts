import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Exige um Bearer token válido. Usado onde o login é obrigatório (baixar o zip). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
