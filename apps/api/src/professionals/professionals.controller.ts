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
import { ProfessionalsService } from './professionals.service';
import { CreateProfessionalDto } from './dto/create-professional.dto';
import { UpdateProfessionalDto } from './dto/update-professional.dto';

@Controller('companies/:companyId/professionals')
@UseGuards(JwtAuthGuard)
export class ProfessionalsController {
  constructor(private readonly professionalsService: ProfessionalsService) {}

  @Get()
  async list(@Param('companyId') companyId: string) {
    return this.professionalsService.list(companyId);
  }

  @Post()
  async create(
    @Param('companyId') companyId: string,
    @Body() dto: CreateProfessionalDto,
  ) {
    return this.professionalsService.create(companyId, dto);
  }

  @Get(':id')
  async getById(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.professionalsService.getById(id, companyId);
  }

  @Patch(':id')
  async update(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProfessionalDto,
  ) {
    return this.professionalsService.update(id, companyId, dto);
  }

  @Delete(':id')
  async delete(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
  ) {
    return this.professionalsService.delete(id, companyId);
  }

  @Patch(':id/services')
  async assignServices(
    @Param('companyId') companyId: string,
    @Param('id') id: string,
    @Body('serviceIds') serviceIds: string[],
  ) {
    return this.professionalsService.assignServices(id, companyId, serviceIds);
  }
}
