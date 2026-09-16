import { Module } from '@nestjs/common';
import { CloneController } from './clone.controller';
import { CloneService } from './clone.service';

@Module({
  controllers: [CloneController],
  providers: [CloneService],
  exports: [CloneService],
})
export class CloneModule {}
