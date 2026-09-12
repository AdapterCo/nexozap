import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { CommonModule } from '../common/common.module';
import { AIModule } from '../ai/ai.module';
import { FlowsModule } from '../flows/flows.module';

@Module({
  imports: [CommonModule, AIModule, FlowsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppService],
  exports: [WhatsAppService],
})
export class WhatsAppModule {}
