import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** Entrada de registrar e entrar: e-mail válido e senha com tamanho mínimo. */
export class AuthDto {
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email!: string;

  @IsString()
  @MinLength(6, { message: 'A senha precisa de pelo menos 6 caracteres' })
  @MaxLength(100)
  senha!: string;
}
