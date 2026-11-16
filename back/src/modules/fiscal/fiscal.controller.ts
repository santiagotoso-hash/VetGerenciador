import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { FiscalService } from './fiscal.service';
import { CancelInvoiceDto, PrepareInvoicesDto, RegisterInvoiceDto, UpdateFiscalSettingsDto } from './dto';

@ApiTags('Fiscal')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly service: FiscalService) {}

  @Get('settings') settings() { return this.service.getSettings(); }
  @Roles('ADMIN') @Patch('settings') update(@Body() dto: UpdateFiscalSettingsDto) { return this.service.updateSettings(dto); }
  @Get('readiness') readiness() { return this.service.readiness(); }

  @Get('invoices') list(@Query('saleId') saleId?: string) { return this.service.list(saleId); }
  @Get('invoices/:id') get(@Param('id') id: string) { return this.service.get(id); }

  @Roles('ADMIN', 'RECEPTIONIST')
  @Post('sales/:saleId/invoices')
  prepare(@Param('saleId') saleId: string, @Body() dto: PrepareInvoicesDto) { return this.service.prepareFromSale(saleId, dto); }

  @Roles('ADMIN', 'RECEPTIONIST') @Post('invoices/:id/refresh') refresh(@Param('id') id: string) { return this.service.refresh(id); }
  @Roles('ADMIN', 'RECEPTIONIST') @Post('invoices/:id/emit') emit(@Param('id') id: string) { return this.service.emit(id); }
  @Roles('ADMIN', 'RECEPTIONIST') @Post('invoices/:id/register') register(@Param('id') id: string, @Body() dto: RegisterInvoiceDto) { return this.service.register(id, dto); }
  @Roles('ADMIN') @Post('invoices/:id/cancel') cancel(@Param('id') id: string, @Body() dto: CancelInvoiceDto) { return this.service.cancel(id, dto); }
}
