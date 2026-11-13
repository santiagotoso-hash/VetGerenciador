import { Module } from '@nestjs/common';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotifier } from './appointment-notifier';

@Module({
  controllers: [AppointmentsController],
  providers: [AppointmentsService, AppointmentNotifier],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
