import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { FiscalModule } from '../fiscal/fiscal.module';

@Module({ imports: [FiscalModule], controllers: [SalesController], providers: [SalesService], exports: [SalesService] })
export class SalesModule {}
