import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class LinkRuleDto {
  /** Trecho do link original que identifica o checkout. */
  @IsString()
  @MinLength(4)
  from!: string;

  @IsUrl({ require_protocol: true })
  to!: string;
}

export class CloneRequestDto {
  /**
   * require_tld: false libera hosts sem ponto, como http://localhost:4173 das páginas de teste.
   * Quem decide o que é endereço seguro é a trava de SSRF (url-guard), não esta validação.
   */
  @IsUrl(
    { require_protocol: true, require_tld: false },
    { message: 'Informe uma URL começando com http:// ou https://' },
  )
  url!: string;

  /** Pula o fetch e vai direto para o navegador (Etapa 4). */
  @IsOptional()
  @IsBoolean()
  forceRender?: boolean;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LinkRuleDto)
  @ArrayMaxSize(20)
  links?: LinkRuleDto[];

  /**
   * Termo de uso: o usuário declara que tem autorização para clonar a página.
   * A ferramenta não existe para copiar página de terceiro nem para phishing.
   */
  @IsBoolean()
  @Equals(true, { message: 'É preciso aceitar o termo de uso' })
  acceptedTerms!: boolean;
}
