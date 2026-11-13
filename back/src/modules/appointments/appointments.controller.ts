import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto, UpdateAppointmentDto, UpdateStatusDto } from './dto';

@ApiTags('Appointments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly service: AppointmentsService) {}

  @Post() create(@Body() dto: CreateAppointmentDto) { return this.service.create(dto); }
  @Get() findAll(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
    @Query('petId') petId?: string,
    @Query('veterinarianId') vetId?: string,
    @Query('clientId') clientId?: string,
  ) { return this.service.findAll(from, to, status, petId, vetId, clientId); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) { return this.service.update(id, dto); }
  @Patch(':id/status') updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) { return this.service.updateStatus(id, dto.status); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
