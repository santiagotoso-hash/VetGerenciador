import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompaniesService } from './companies.service';
import { CompanyUserDto, CreateCompanyDto, UpdateCompanyDto, UpdateCompanyUserDto } from './dto';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('companies')
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Post() create(@Body() dto: CreateCompanyDto) { return this.service.create(dto); }
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) { return this.service.update(id, dto); }
  @Post(':id/users') addUser(@Param('id') id: string, @Body() dto: CompanyUserDto) { return this.service.addUser(id, dto); }
  @Patch(':id/users/:userId') updateUser(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateCompanyUserDto) {
    return this.service.updateUser(id, userId, dto);
  }
}
