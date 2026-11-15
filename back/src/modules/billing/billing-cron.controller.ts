import { Controller, ForbiddenException, Get, Headers } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { timingSafeEqual } from 'crypto';
import { BillingChargeService } from './billing-charge.service';

/** Chamado uma vez por dia pelo Cron da Vercel (envia o header "Authorization: Bearer <CRON_SECRET>"). */
@ApiExcludeController()
@Controller('cron')
export class BillingCronController {
  constructor(private readonly charges: BillingChargeService) {}

  @Get('billing')
  async billing(@Headers('authorization') auth?: string) {
    const secret = process.env.CRON_SECRET;
    const given = Buffer.from(auth ?? '');
    const expected = Buffer.from(`Bearer ${secret}`);
    if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) {
      throw new ForbiddenException('Não autorizado');
    }
    return this.charges.runDueCharges();
  }
}
