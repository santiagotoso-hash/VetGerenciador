import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { TenantInterceptor } from './common/tenant';
import { CompaniesModule } from './modules/companies/companies.module';
import { BillingModule } from './modules/billing/billing.module';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './modules/mail/mail.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { ClientsModule } from './modules/clients/clients.module';
import { PetsModule } from './modules/pets/pets.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { MedicalRecordsModule } from './modules/medical-records/medical-records.module';
import { ProductsModule } from './modules/products/products.module';
import { ServicesModule } from './modules/services/services.module';
import { SalesModule } from './modules/sales/sales.module';
import { FinancialModule } from './modules/financial/financial.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    MailModule,
    AuthModule,
    UsersModule,
    ClientsModule,
    PetsModule,
    AppointmentsModule,
    MedicalRecordsModule,
    ProductsModule,
    ServicesModule,
    SalesModule,
    FinancialModule,
    ReportsModule,
    BillingModule,
    CompaniesModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: TenantInterceptor }],
})
export class AppModule {}
