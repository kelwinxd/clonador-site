import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { UserRepository } from './user.repository';

/** Dados que vão dentro do JWT (sub = id do usuário, padrão do JWT). */
export interface JwtPayload {
  sub: string;
  email: string;
  plano: string;
}

export interface AuthResult {
  token: string;
  user: { id: string; email: string; plano: string };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly users: UserRepository,
    private readonly jwt: JwtService,
  ) {}

  async registrar(email: string, senha: string): Promise<AuthResult> {
    const normalizado = email.trim().toLowerCase();
    const existente = await this.users.porEmail(normalizado);
    if (existente) throw new ConflictException('Já existe uma conta com esse e-mail.');

    const senhaHash = await bcrypt.hash(senha, 10);
    const user = await this.users.criar(normalizado, senhaHash);
    this.logger.log(`conta criada: ${normalizado}`);
    return this.emitir(user.id, user.email, user.plano);
  }

  async entrar(email: string, senha: string): Promise<AuthResult> {
    const normalizado = email.trim().toLowerCase();
    const user = await this.users.porEmail(normalizado);
    // Mesma mensagem para e-mail inexistente e senha errada: não entrega quais e-mails existem.
    const ok = user && (await bcrypt.compare(senha, user.senhaHash));
    if (!user || !ok) throw new UnauthorizedException('E-mail ou senha incorretos.');
    return this.emitir(user.id, user.email, user.plano);
  }

  private emitir(id: string, email: string, plano: string): AuthResult {
    const payload: JwtPayload = { sub: id, email, plano };
    return { token: this.jwt.sign(payload), user: { id, email, plano } };
  }
}
