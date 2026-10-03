import { Controller, Get, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { RATE_LIMIT } from './config';
import { CloneModule } from './clone/clone.module';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }
}

@Module({
  imports: [
    // Limite de taxa disponível para os controllers (aplicado só onde o guard é usado).
    ThrottlerModule.forRoot([{ ttl: RATE_LIMIT.ttlMs, limit: RATE_LIMIT.limit }]),
    CloneModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
