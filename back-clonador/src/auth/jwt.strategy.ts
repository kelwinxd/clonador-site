import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH } from '../config';
import { JwtPayload } from './auth.service';

/** Usuário autenticado, anexado ao request (req.user) quando o token é válido. */
export interface UsuarioAutenticado {
  userId: string;
  email: string;
}

/**
 * Valida o Bearer token das rotas protegidas. O Passport já checa assinatura e validade;
 * aqui só traduzimos o payload para o formato que os controllers usam.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: AUTH.jwtSecret,
    });
  }

  validate(payload: JwtPayload): UsuarioAutenticado {
    return { userId: payload.sub, email: payload.email };
  }
}
