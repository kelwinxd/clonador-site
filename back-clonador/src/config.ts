/**
 * Limites do motor de clonagem.
 * Ficam num lugar só para serem fáceis de ajustar quando o projeto for para o servidor.
 */
export const LIMITS = {
  /** Tempo máximo para baixar o HTML da página. */
  pageTimeoutMs: 20_000,
  /** Tempo máximo para baixar cada asset (imagem, css, fonte...). */
  assetTimeoutMs: 15_000,
  /** HTML maior que isso é recusado. */
  maxHtmlBytes: 5 * 1024 * 1024,
  /** Asset maior que isso é pulado. */
  maxAssetBytes: 10 * 1024 * 1024,
  /** Soma de todos os assets de um clone. */
  maxTotalBytes: 80 * 1024 * 1024,
  /** Quantidade máxima de assets por clone. */
  maxAssets: 300,
  /** Downloads em paralelo. */
  assetConcurrency: 8,
  /** Redirecionamentos seguidos antes de desistir. */
  maxRedirects: 5,

  /** Navegação no Playwright: tempo máximo para a página abrir. */
  renderTimeoutMs: 30_000,
  /** Espera pela rede ficar quieta. Página com polling nunca fica, então tem teto. */
  renderIdleMs: 5_000,
  /** Quantas telas rolar para disparar imagens e seções que carregam tarde. */
  renderScrollSteps: 15,
  /** Abas renderizando ao mesmo tempo no mesmo navegador. A fila limita o resto. */
  maxRenderPages: 2,
} as const;

/** Fila (BullMQ) e armazenamento do resultado. */
export const QUEUE = {
  /** Nome da fila no Redis. */
  name: 'clone',
  /**
   * Jobs processados ao mesmo tempo por instância. Fica acima de maxRenderPages de propósito:
   * clones que só usam fetch não ficam presos atrás dos que abrem o navegador.
   */
  concurrency: Number(process.env.CLONE_CONCURRENCY ?? 5),
  /** Quanto tempo o .zip fica disponível para download antes da limpeza. */
  resultTtlMs: Number(process.env.RESULT_TTL_MS ?? 30 * 60_000),
  /** De quanto em quanto tempo a limpeza roda. */
  cleanupEveryMs: 5 * 60_000,
  /** Jobs concluídos/falhados que o Redis guarda (para o status ainda responder). */
  keepCompleted: 200,
  keepFailed: 200,
} as const;

/**
 * Limite de taxa do POST /clone (abuso / custo).
 * Padrão: 10 clones por hora por IP. ttl em MILISSEGUNDOS (exigência do @nestjs/throttler v6).
 */
export const RATE_LIMIT = {
  ttlMs: Number(process.env.RATE_TTL_MS ?? 60 * 60_000),
  limit: Number(process.env.RATE_LIMIT ?? 10),
} as const;

/**
 * Saltos de proxy confiáveis (trust proxy). No Railway é 1 (o balanceador na frente).
 * Sem isso, atrás de proxy todo mundo aparece com o mesmo IP e o limite não funciona.
 * Local (sem proxy) pode ficar 1 também — não atrapalha.
 */
export const TRUST_PROXY = Number(process.env.TRUST_PROXY ?? 1);

/**
 * URL do Redis.
 * Ordem: REDIS_URL cheia -> monta a partir das peças (REDISHOST/PORT/USER/PASSWORD, que
 * o Railway expõe) -> padrão local. Assim funciona de qualquer jeito que o provedor dê.
 */
function resolveRedisUrl(): string {
  const direta = process.env.REDIS_URL?.trim();
  if (direta) return direta;

  const host = (process.env.REDISHOST ?? process.env.REDIS_HOST ?? '').trim();
  if (host) {
    const port = (process.env.REDISPORT ?? process.env.REDIS_PORT ?? '6379').trim();
    const user = (process.env.REDISUSER ?? process.env.REDIS_USER ?? 'default').trim();
    const pass = (process.env.REDISPASSWORD ?? process.env.REDIS_PASSWORD ?? '').trim();
    const auth = pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
    return `redis://${auth}${host}:${port}`;
  }

  return 'redis://127.0.0.1:6379';
}

export const REDIS_URL = resolveRedisUrl();

/**
 * Origens liberadas no CORS (HTTP e WebSocket).
 * Com CORS_ORIGIN definido (produção): só a lista. Sem ele (dev): qualquer localhost.
 */
export function corsOrigin(): string[] | RegExp {
  const lista = process.env.CORS_ORIGIN?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return lista && lista.length ? lista : /^http:\/\/localhost:\d+$/;
}

/**
 * Autenticação (Etapa 15). Login é opcional: clonar e pré-visualizar são livres;
 * baixar o zip e editar exigem conta. O segredo assina o JWT — em produção vem do ambiente.
 */
export const AUTH = {
  jwtSecret: process.env.JWT_SECRET?.trim() || 'dev-secret-trocar-em-producao',
  /** Validade do token, em segundos (padrão 7 dias). */
  expiresInSeconds: Number(process.env.JWT_EXPIRES_IN_S ?? 7 * 24 * 60 * 60),
} as const;

/**
 * reCAPTCHA (anti-spam no POST /clone). Opcional: sem o secret, a verificação é pulada
 * (desenvolvimento). Em produção, defina RECAPTCHA_SECRET para exigir o token do front.
 */
export const RECAPTCHA = {
  secret: process.env.RECAPTCHA_SECRET?.trim() || '',
  /** Nota mínima do reCAPTCHA v3 (0..1) para aceitar. Abaixo disso é tratado como robô. */
  minScore: Number(process.env.RECAPTCHA_MIN_SCORE ?? 0.5),
} as const;

/**
 * Máximo de clones por IP ao mesmo tempo (na fila ou rodando). Protege de rajadas/abuso,
 * além do limite por hora (@nestjs/throttler). Contador fica no Redis com TTL de segurança.
 */
export const IP_MAX_CONCURRENT = Number(process.env.IP_MAX_CONCURRENT ?? 2);

/**
 * Marca d'água dos clones do plano grátis. O download do Free leva um selo com link; o Pro
 * sai limpo. A URL do selo aponta de volta para o app (vira propaganda).
 */
export const WATERMARK = {
  url: process.env.WATERMARK_URL?.trim() || 'https://clonador-site-olive.vercel.app',
} as const;

/**
 * Cota de clones por ciclo (créditos). Login é obrigatório para clonar; cada clone com sucesso
 * gasta 1 crédito. Free tem teto mensal; Pro é ilimitado.
 */
export const CREDITOS = {
  freePorCiclo: Number(process.env.FREE_CREDITS_MES ?? 3),
  cicloDias: Number(process.env.CREDITS_CICLO_DIAS ?? 30),
} as const;

/** User-Agent de navegador real: muitas páginas recusam clientes sem isso. */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
