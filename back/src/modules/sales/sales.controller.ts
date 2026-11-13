import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto';

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly service: SalesService) {}

  @Post() create(@Body() dto: CreateSaleDto, @Request() req) { return this.service.create(dto, req.user.id); }
  @Get() findAll(@Query('from') from?: string, @Query('to') to?: string, @Query('clientId') clientId?: string) { return this.service.findAll(from, to, clientId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
}
