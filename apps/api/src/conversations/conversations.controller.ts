import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { ConversationsService } from './conversations.service';

@Controller('companies/:companyId/conversations')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get()
  list(@Param('companyId') companyId: string, @Query('status') status?: string, @Query('mode') mode?: string) {
    return this.conversations.list(companyId, status, mode);
  }

  @Get(':id/messages')
  messages(@Param('companyId') companyId: string, @Param('id') id: string) {
    return this.conversations.messages(companyId, id);
  }

  @Post(':id/messages')
  send(@Param('companyId') companyId: string, @Param('id') id: string, @Body('content') content: string) {
    return this.conversations.send(companyId, id, content);
  }

  @Patch(':id')
  update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() body: { mode?: 'FLOW' | 'AI' | 'HUMAN'; status?: 'ACTIVE' | 'ARCHIVED' },
  ) {
    return this.conversations.update(companyId, id, body);
  }
}
