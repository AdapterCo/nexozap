import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CompaniesService } from './companies.service';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async list(@CurrentUser() user: any) {
    return this.companiesService.listByUserId(user.sub);
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.companiesService.getById(id, user.sub);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
    @CurrentUser() user: any,
  ) {
    await this.companiesService.getById(id, user.sub);
    return this.companiesService.update(id, dto);
  }
}
