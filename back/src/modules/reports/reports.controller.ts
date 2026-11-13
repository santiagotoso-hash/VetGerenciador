import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

function range(from?: string, to?: string) {
  if (!from || !to) throw new BadRequestException('Informe from e to (data ISO)');
  return [from, to] as const;
}

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('dashboard') dashboard() { return this.service.dashboard(); }
  @Get('revenue') revenue(@Query('from') from?: string, @Query('to') to?: string) { return this.service.revenueByDay(...range(from, to)); }
  @Get('appointments') appointments(@Query('from') from?: string, @Query('to') to?: string) { return this.service.appointmentsByDay(...range(from, to)); }
  @Get('top-items') topItems(@Query('from') from?: string, @Query('to') to?: string) { return this.service.topItems(...range(from, to)); }
  @Get('appointments-status') appointmentsStatus(@Query('from') from?: string, @Query('to') to?: string) { return this.service.appointmentsByStatus(...range(from, to)); }
  @Get('species') species() { return this.service.speciesDistribution(); }
}
