import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Queue } from 'bullmq';
import type { Request, Response } from 'express';
import { CreditsService } from '../auth/credits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsuarioAutenticado } from '../auth/jwt.strategy';
import { QUEUE } from '../config';
import { aplicarMarcaDaguaZip } from './engine/watermark';
import { CloneRequestDto } from './dto/clone-request.dto';
import { CloneJobData, CloneJobResult, CloneProgress } from './types';
import { parseFailedReason } from './clone.worker';
import { CLONE_QUEUE } from './queue.provider';
import { CloneErrorCode } from './engine/types';
import { IpGuardService } from './ip-guard.service';
import { RecaptchaService } from './recaptcha.service';
import { ResultStore } from './result-store';

const STATUS_BY_CODE: Record<CloneErrorCode | 'UNKNOWN', HttpStatus> = {
  INVALID_URL: HttpStatus.BAD_REQUEST,
  BLOCKED_HOST: HttpStatus.FORBIDDEN,
  BLOCKED_CONTENT: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  FETCH_FAILED: HttpStatus.BAD_GATEWAY,
  RENDER_FAILED: HttpStatus.BAD_GATEWAY,
  UNKNOWN: HttpStatus.INTERNAL_SERVER_ERROR,
};

type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';

interface CloneStatusResponse {
  id: string;
  state: JobState;
  progress: CloneProgress | null;
  result: CloneJobResult | null;
  error: { code: string; message: string } | null;
}

/**
 * Contrato da fila (Etapa 6):
 * - POST /clone           -> enfileira e devolve { id }
 * - GET  /clone/:id       -> estado + progresso (ou resultado, ou erro)
 * - GET  /clone/:id/download -> o .zip, quando pronto
 */
@Controller('clone')
export class CloneController {
  constructor(
    @Inject(CLONE_QUEUE) private readonly queue: Queue<CloneJobData>,
    private readonly resultStore: ResultStore,
    private readonly recaptcha: RecaptchaService,
    private readonly ipGuard: IpGuardService,
    private readonly credits: CreditsService,
  ) {}

  // Clonar exige login (cada clone gasta 1 crédito). Rate limit extra por IP.
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueue(@Body() body: CloneRequestDto, @Req() req: Request): Promise<{ id: string }> {
    const ip = req.ip ?? 'desconhecido';
    const user = req.user as UsuarioAutenticado;

    // 1. Anti-robô: valida o token do reCAPTCHA (pulado se o reCAPTCHA estiver desligado).
    if (!(await this.recaptcha.verificar(body.captchaToken, ip))) {
      throw new HttpException(
        { code: 'CAPTCHA', message: 'Verificação anti-robô falhou. Recarregue a página e tente de novo.' },
        HttpStatus.FORBIDDEN,
      );
    }

    // 2. Cota: Free tem teto mensal de clones; Pro é ilimitado.
    if (!(await this.credits.podeClonar(user.userId))) {
      throw new HttpException(
        { code: 'SEM_CREDITO', message: 'Você usou seus clones grátis do mês. Vire Pro para clonar mais.' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    // 3. Concorrência por IP: no máximo N clones em andamento por IP ao mesmo tempo.
    if (!(await this.ipGuard.entrar(ip))) {
      throw new HttpException(
        { code: 'RATE_LIMIT', message: 'Você já tem clones em andamento. Espere terminar antes de pedir outro.' },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let job;
    try {
      job = await this.queue.add(
        'clone',
        {
          url: body.url,
          links: body.links,
          pixels: body.pixels,
          forceRender: body.forceRender,
          ip,
          userId: user.userId,
        },
        {
          removeOnComplete: { count: QUEUE.keepCompleted },
          removeOnFail: { count: QUEUE.keepFailed },
        },
      );
    } catch {
      // Não entrou na fila: devolve a vaga de concorrência que acabei de ocupar.
      await this.ipGuard.sair(ip);
      throw new ServiceUnavailableException('A fila está indisponível. O Redis está rodando?');
    }
    return { id: String(job.id) };
  }

  @Get(':id')
  async status(@Param('id') id: string): Promise<CloneStatusResponse> {
    const job = await this.queue.getJob(id).catch(() => null);
    if (!job) {
      throw new NotFoundException('Clone não encontrado (pode ter expirado).');
    }

    const state = normalizeState(await job.getState());

    if (state === 'failed') {
      const failure = parseFailedReason(job.failedReason);
      return {
        id,
        state,
        progress: null,
        result: null,
        error: { code: failure.code, message: failure.message },
      };
    }

    return {
      id,
      state,
      progress: (job.progress as CloneProgress) || null,
      result: state === 'completed' ? (job.returnvalue as CloneJobResult) : null,
      error: null,
    };
  }

  /**
   * Prévia servida pelo backend: HTML autossuficiente, LIVRE (sem login). O anônimo vê o clone,
   * mas não leva o zip limpo (esse exige conta). Aberto num iframe pelo front.
   */
  @Get(':id/preview')
  async preview(@Param('id') id: string, @Res() response: Response): Promise<void> {
    const html = await this.resultStore.readPreview(id);
    if (html == null) {
      throw new NotFoundException('Prévia indisponível: o clone não terminou ou já expirou.');
    }
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.send(html);
  }

  // Baixar exige conta. Free leva marca d'água; Pro baixa limpo.
  @UseGuards(JwtAuthGuard)
  @Get(':id/download')
  async download(@Param('id') id: string, @Req() req: Request, @Res() response: Response): Promise<void> {
    const job = await this.queue.getJob(id).catch(() => null);
    const result = job?.returnvalue as CloneJobResult | undefined;

    if (!result || !(await this.resultStore.exists(id))) {
      // Falhou, ainda não terminou, ou o arquivo já expirou.
      if (job && (await job.getState()) === 'failed') {
        const failure = parseFailedReason(job.failedReason);
        throw new HttpException(
          { code: failure.code, message: failure.message },
          STATUS_BY_CODE[failure.code],
        );
      }
      throw new NotFoundException('Zip indisponível: o clone não terminou ou já expirou.');
    }

    const user = req.user as UsuarioAutenticado | undefined;
    const enviarCabecalhos = () => {
      response.setHeader('Content-Type', 'application/zip');
      response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    };

    // Pro: zip limpo (stream direto, sem carregar na memória).
    if (user?.plano === 'pro') {
      const stream = this.resultStore.openZip(id);
      if (!stream) throw new NotFoundException('Zip indisponível.');
      enviarCabecalhos();
      stream.pipe(response);
      return;
    }

    // Free: injeta a marca d'água no index.html antes de entregar.
    const zip = await this.resultStore.readZip(id);
    if (!zip) throw new NotFoundException('Zip indisponível.');
    enviarCabecalhos();
    response.send(aplicarMarcaDaguaZip(zip));
  }
}

function normalizeState(state: string): JobState {
  if (state === 'completed' || state === 'active' || state === 'failed') return state;
  if (state === 'waiting' || state === 'delayed' || state === 'prioritized') return 'waiting';
  return 'unknown';
}
