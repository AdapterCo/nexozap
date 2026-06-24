import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { ServicesModule } from './services/services.module';
import { ProfessionalsModule } from './professionals/professionals.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { FlowsModule } from './flows/flows.module';
import { AIModule } from './ai/ai.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RemindersModule } from './reminders/reminders.module';
import { ReportsModule } from './reports/reports.module';
import { EvaluationsModule } from './evaluations/evaluations.module';
import { ClientsModule } from './clients/clients.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    CompaniesModule,
    ServicesModule,
    ProfessionalsModule,
    AppointmentsModule,
    WhatsAppModule,
    FlowsModule,
    AIModule,
    DashboardModule,
    RemindersModule,
    ReportsModule,
    EvaluationsModule,
    ClientsModule,
  ],
})
export class AppModule {}
