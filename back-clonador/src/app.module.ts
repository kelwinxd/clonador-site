import { Controller, Get, Module } from '@nestjs/common';
import { CloneModule } from './clone/clone.module';

@Controller('health')
class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: process.uptime() };
  }
}

@Module({
  imports: [CloneModule],
  controllers: [HealthController],
})
export class AppModule {}
