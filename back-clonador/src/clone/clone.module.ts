import { Module } from '@nestjs/common';
import { BrowserService } from './browser.service';
import { CloneController } from './clone.controller';
import { CloneGateway } from './clone.gateway';
import { CloneService } from './clone.service';
import { CloneWorker } from './clone.worker';
import { cloneQueueProvider } from './queue.provider';
import { ResultStore } from './result-store';

@Module({
  controllers: [CloneController],
  providers: [
    CloneService,
    BrowserService,
    ResultStore,
    CloneWorker,
    CloneGateway,
    cloneQueueProvider,
  ],
  exports: [CloneService],
})
export class CloneModule {}
