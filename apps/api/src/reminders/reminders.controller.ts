import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { ConfigureRemindersDto } from './dto/configure-reminders.dto';
import { RemindersService } from './reminders.service';

@Controller('companies/:companyId/notifications')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get('config')
  getConfig(@Param('companyId') companyId: string) {
    return this.reminders.getConfig(companyId);
  }

  @Patch('config')
  updateConfig(@Param('companyId') companyId: string, @Body() dto: ConfigureRemindersDto) {
    return this.reminders.updateConfig(companyId, dto);
  }
}
