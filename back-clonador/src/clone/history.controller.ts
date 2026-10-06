import { Controller, Get, Query } from '@nestjs/common';
import { CloneRepository } from './clone.repository';

/** Histórico de clones. GET /history?limit=50 */
@Controller('history')
export class HistoryController {
  constructor(private readonly history: CloneRepository) {}

  @Get()
  async listar(@Query('limit') limit?: string) {
    const n = Number(limit);
    return this.history.recentes(Number.isFinite(n) && n > 0 ? n : 50);
  }
}
