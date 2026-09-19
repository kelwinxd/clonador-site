import { Module } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { CloneController } from './clone.controller';
import { CloneService } from './clone.service';
import { CloneWorker } from './clone.worker';
import { cloneQueueProvider } from './queue.provider';
import { ResultStore } from './result-store';

@Module({
  controllers: [CloneController],
  providers: [CloneService, BrowserService, ResultStore, CloneWorker, cloneQueueProvider],
  exports: [CloneService],
})
export class CloneModule {}
