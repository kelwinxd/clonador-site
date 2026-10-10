import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Acesso à tabela de usuários. Fino de propósito: só o que o AuthService precisa. */
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  porEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  porId(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  criar(email: string, senhaHash: string) {
    return this.prisma.user.create({ data: { email, senhaHash } });
  }
}
