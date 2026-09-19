import { Module } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { CloneController } from './clone.controller';
import { CloneService } from './clone.service';

@Module({
  controllers: [CloneController],
  providers: [CloneService, BrowserService],
  exports: [CloneService],
})
export class CloneModule {}
