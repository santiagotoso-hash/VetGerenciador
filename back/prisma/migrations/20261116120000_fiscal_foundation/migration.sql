-- Base para nota fiscal: dados fiscais da empresa, dos produtos e serviços, e a tabela de notas.
-- Tudo opcional; o recurso fica desligado (fiscalEnabled = false) até o superadmin ligar.

-- CreateEnum
CREATE TYPE "TaxRegime" AS ENUM ('MEI', 'SIMPLES', 'PRESUMIDO', 'REAL');
CREATE TYPE "InvoiceType" AS ENUM ('NFSE', 'NFE', 'NFCE');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELED');

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "stateRegistration" TEXT,
ADD COLUMN "municipalRegistration" TEXT,
ADD COLUMN "taxRegime" "TaxRegime",
ADD COLUMN "cityIbgeCode" TEXT,
ADD COLUMN "fiscalEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fiscalProvider" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "fiscalEnvironment" TEXT NOT NULL DEFAULT 'HOMOLOGACAO';

ALTER TABLE "products" ADD COLUMN "ncm" TEXT,
ADD COLUMN "cfop" TEXT,
ADD COLUMN "taxCode" TEXT,
ADD COLUMN "origin" INTEGER;

ALTER TABLE "services" ADD COLUMN "serviceCode" TEXT,
ADD COLUMN "nbs" TEXT,
ADD COLUMN "issRate" DOUBLE PRECISION,
ADD COLUMN "cnae" TEXT;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "type" "InvoiceType" NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "environment" TEXT NOT NULL DEFAULT 'HOMOLOGACAO',
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "number" TEXT,
    "series" TEXT,
    "accessKey" TEXT,
    "protocol" TEXT,
    "issuedAt" TIMESTAMP(3),
    "amount" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "recipientName" TEXT,
    "recipientDocument" TEXT,
    "items" JSONB NOT NULL,
    "pdfUrl" TEXT,
    "xmlUrl" TEXT,
    "externalId" TEXT,
    "errorMessage" TEXT,
    "cancelReason" TEXT,
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "saleId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_companyId_status_idx" ON "invoices"("companyId", "status");
CREATE INDEX "invoices_saleId_idx" ON "invoices"("saleId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
