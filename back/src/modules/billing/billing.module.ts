import { Global, Module } from '@nestjs/common';
import { BillingChargeService } from './billing-charge.service';
import { BillingCronController } from './billing-cron.controller';

@Global()
@Module({
  controllers: [BillingCronController],
  providers: [BillingChargeService],
  exports: [BillingChargeService],
})
export class BillingModule {}
