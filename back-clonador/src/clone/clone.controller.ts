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
  Res,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import type { Response } from 'express';
import { QUEUE } from '../config';
import { CloneRequestDto } from './dto/clone-request.dto';
import { CloneJobData, CloneProgress } from './clone.types';
import { CloneJobResult, parseFailedReason } from './clone.worker';
import { CLONE_QUEUE } from './queue.provider';
import { CloneErrorCode } from './engine/errors';
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
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async enqueue(@Body() body: CloneRequestDto): Promise<{ id: string }> {
    let job;
    try {
      job = await this.queue.add(
        'clone',
        { url: body.url, links: body.links, forceRender: body.forceRender },
        {
          removeOnComplete: { count: QUEUE.keepCompleted },
          removeOnFail: { count: QUEUE.keepFailed },
        },
      );
    } catch {
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

  @Get(':id/download')
  async download(@Param('id') id: string, @Res() response: Response): Promise<void> {
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

    const stream = this.resultStore.openZip(id);
    if (!stream) throw new NotFoundException('Zip indisponível.');

    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    stream.pipe(response);
  }
}

function normalizeState(state: string): JobState {
  if (state === 'completed' || state === 'active' || state === 'failed') return state;
  if (state === 'waiting' || state === 'delayed' || state === 'prioritized') return 'waiting';
  return 'unknown';
}
