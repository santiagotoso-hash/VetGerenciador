import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FinancialService } from './financial.service';
import { CreateFinancialEntryDto, UpdateFinancialEntryDto } from './dto';

@ApiTags('Financial')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('financial')
export class FinancialController {
  constructor(private readonly service: FinancialService) {}

  @Post() create(@Body() dto: CreateFinancialEntryDto) { return this.service.create(dto); }
  @Get() findAll(@Query('from') from?: string, @Query('to') to?: string, @Query('type') type?: string, @Query('paid') paid?: string) { return this.service.findAll(from, to, type, paid); }
  @Get('summary') summary(@Query('from') from?: string, @Query('to') to?: string) { return this.service.summary(from, to); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateFinancialEntryDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
