import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CompaniesService } from './companies.service';
import {
  CompanyUserDto, CreateCompanyDto, CreatePaymentDto, InvoiceSettingsDto, SendInvoiceDto, UpdateCompanyDto,
  UpdateCompanyUserDto,
} from './dto';

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

  @Get(':id/usage') usage(@Param('id') id: string) { return this.service.usage(id); }

  @Post(':id/users') addUser(@Param('id') id: string, @Body() dto: CompanyUserDto) { return this.service.addUser(id, dto); }
  @Patch(':id/users/:userId') updateUser(@Param('id') id: string, @Param('userId') userId: string, @Body() dto: UpdateCompanyUserDto) {
    return this.service.updateUser(id, userId, dto);
  }

  // Financeiro
  @Put(':id/invoice') setInvoice(@Param('id') id: string, @Body() dto: InvoiceSettingsDto) { return this.service.setInvoice(id, dto); }
  @Post(':id/invoice/send') sendInvoice(@Param('id') id: string, @Body() dto: SendInvoiceDto) { return this.service.sendInvoice(id, dto.email); }
  @Get(':id/payments') listPayments(@Param('id') id: string) { return this.service.listPayments(id); }
  @Post(':id/payments') addPayment(@Param('id') id: string, @Body() dto: CreatePaymentDto, @Request() req) {
    return this.service.addPayment(id, dto, req.user.id);
  }
  @Delete('payments/:paymentId') removePayment(@Param('paymentId') paymentId: string) { return this.service.removePayment(paymentId); }
}
