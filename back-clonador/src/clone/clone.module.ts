import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BrowserService } from './browser.service';
import { CloneController } from './clone.controller';
import { CloneGateway } from './clone.gateway';
import { CloneRepository } from './clone.repository';
import { CloneService } from './clone.service';
import { CloneWorker } from './clone.worker';
import { HistoryController } from './history.controller';
import { cloneQueueProvider } from './queue.provider';
import { ResultStore } from './result-store';

@Module({
  controllers: [CloneController, HistoryController],
  providers: [
    CloneService,
    BrowserService,
    ResultStore,
    CloneWorker,
    CloneGateway,
    CloneRepository,
    PrismaService,
    cloneQueueProvider,
  ],
  exports: [CloneService],
})
export class CloneModule {}
