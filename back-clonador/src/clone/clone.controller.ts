import { Body, Controller, HttpException, HttpStatus, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CloneService } from './clone.service';
import { CloneRequestDto } from './dto/clone-request.dto';
import { CloneError, CloneErrorCode } from './engine/errors';

const STATUS_BY_CODE: Record<CloneErrorCode, HttpStatus> = {
  INVALID_URL: HttpStatus.BAD_REQUEST,
  BLOCKED_HOST: HttpStatus.FORBIDDEN,
  BLOCKED_CONTENT: HttpStatus.UNSUPPORTED_MEDIA_TYPE,
  TIMEOUT: HttpStatus.GATEWAY_TIMEOUT,
  TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,
  FETCH_FAILED: HttpStatus.BAD_GATEWAY,
  RENDER_FAILED: HttpStatus.BAD_GATEWAY,
};

@Controller('clone')
export class CloneController {
  constructor(private readonly cloneService: CloneService) {}

  /**
   * Fase 1: devolve o zip direto.
   * Na Etapa 6 isso vira { jobId } + fila, com o download num endpoint separado.
   */
  @Post()
  async clone(@Body() body: CloneRequestDto, @Res() response: Response): Promise<void> {
    try {
      const result = await this.cloneService.clone({
        url: body.url,
        links: body.links,
        forceRender: body.forceRender,
      });

      response.setHeader('Content-Type', 'application/zip');
      response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      // O front lê o resumo do clone por aqui (o corpo é binário).
      response.setHeader('X-Clone-Meta', encodeURIComponent(JSON.stringify(result.meta)));
      response.setHeader('Access-Control-Expose-Headers', 'X-Clone-Meta, Content-Disposition');
      response.send(result.zip);
    } catch (error) {
      if (error instanceof CloneError) {
        throw new HttpException(
          { code: error.code, message: error.message },
          STATUS_BY_CODE[error.code],
        );
      }
      throw error;
    }
  }
}
