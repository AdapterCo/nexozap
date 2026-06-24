import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Controller('companies/:companyId/services')
@UseGuards(JwtAuthGuard)
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  async list(
    @Param('companyId') companyId: string,
    @Query('isActive') isActive?: string,
  ) {
    const activeFilter = isActive !== undefined ? isActive === 'true' : undefined;
    return this.servicesService.list(companyId, activeFilter);
  }

  @Post()
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateServiceDto,
  ) {
    return this.servicesService.create(companyId, dto);
  }

  @Patch(':id')
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateServiceDto,
  ) {
    return this.servicesService.update(id, companyId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.servicesService.delete(id, companyId);
  }

  @Patch(':id/toggle')
  async toggle(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.servicesService.toggleActive(id, companyId);
  }
}
