import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { FlowsService } from './flows.service';
import { CreateFlowDto } from './dto/create-flow.dto';

@Controller('companies/:companyId/flows')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class FlowsController {
  constructor(private readonly flowsService: FlowsService) {}

  @Get()
  async list(@Param('companyId') companyId: string) {
    return this.flowsService.list(companyId);
  }

  @Post()
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateFlowDto,
  ) {
    return this.flowsService.create(companyId, dto);
  }

  @Get(':id')
  async getById(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.flowsService.getById(id, companyId);
  }

  @Patch(':id')
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: Partial<CreateFlowDto>,
  ) {
    return this.flowsService.update(id, companyId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.flowsService.delete(id, companyId);
  }

  @Patch(':id/toggle')
  async toggle(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.flowsService.toggle(id, companyId);
  }

  @Post('execute')
  async execute(
    @Param('companyId') companyId: string,
    @Body() body: { conversationId: string; message: string },
  ) {
    return this.flowsService.execute(body.conversationId, body.message, companyId);
  }
}
