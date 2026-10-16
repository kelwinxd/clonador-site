import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../prisma/prisma.service';
import { BrowserService } from './browser.service';
import { CloneController } from './clone.controller';
import { CloneGateway } from './clone.gateway';
import { CloneRepository } from './clone.repository';
import { CloneService } from './clone.service';
import { CloneWorker } from './clone.worker';
import { HistoryController } from './history.controller';
import { IpGuardService } from './ip-guard.service';
import { cloneQueueProvider } from './queue.provider';
import { RecaptchaService } from './recaptcha.service';
import { ResultStore } from './result-store';

@Module({
  imports: [AuthModule],
  controllers: [CloneController, HistoryController],
  providers: [
    CloneService,
    BrowserService,
    ResultStore,
    CloneWorker,
    CloneGateway,
    CloneRepository,
    PrismaService,
    RecaptchaService,
    IpGuardService,
    cloneQueueProvider,
  ],
  exports: [CloneService],
})
export class CloneModule {}
