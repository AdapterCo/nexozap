import { Module } from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { RemindersController } from './reminders.controller';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [PrismaModule, WhatsAppModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
