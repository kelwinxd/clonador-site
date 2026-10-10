import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { UserRepository } from './user.repository';

/**
 * Módulo de contas. Exporta PassportModule/JwtModule para que outros módulos (o de clone)
 * possam usar o JwtAuthGuard na rota de download.
 */
@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: AUTH.jwtSecret,
      signOptions: { expiresIn: AUTH.expiresInSeconds },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UserRepository, JwtStrategy, PrismaService],
  exports: [PassportModule, JwtModule],
})
export class AuthModule {}
