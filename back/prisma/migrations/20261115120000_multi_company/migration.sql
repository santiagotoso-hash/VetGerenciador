-- Multiempresa: cada registro passa a pertencer a uma empresa (companyId).
-- Os dados que já existiam são mantidos e atribuídos à empresa "VetPet (demonstração)".

-- AlterEnum
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");

INSERT INTO "companies" ("id", "name", "slug", "updatedAt")
VALUES ('company_legacy_demo', 'VetPet (demonstração)', 'vetpet-demo', CURRENT_TIMESTAMP);

-- DropIndex (únicos globais viram únicos por empresa)
DROP INDEX "clients_cpf_key";
DROP INDEX "products_sku_key";
DROP INDEX "products_barcode_key";

-- AddColumn: nullable -> preenche -> NOT NULL
ALTER TABLE "users" ADD COLUMN "companyId" TEXT;
UPDATE "users" SET "companyId" = 'company_legacy_demo';

ALTER TABLE "clients" ADD COLUMN "companyId" TEXT;
UPDATE "clients" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "clients" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "pets" ADD COLUMN "companyId" TEXT;
UPDATE "pets" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "pets" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "services" ADD COLUMN "companyId" TEXT;
UPDATE "services" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "services" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "appointments" ADD COLUMN "companyId" TEXT;
UPDATE "appointments" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "appointments" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "medical_records" ADD COLUMN "companyId" TEXT;
UPDATE "medical_records" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "medical_records" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "products" ADD COLUMN "companyId" TEXT;
UPDATE "products" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "products" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "sales" ADD COLUMN "companyId" TEXT;
UPDATE "sales" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "sales" ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "financial_entries" ADD COLUMN "companyId" TEXT;
UPDATE "financial_entries" SET "companyId" = 'company_legacy_demo';
ALTER TABLE "financial_entries" ALTER COLUMN "companyId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");
CREATE INDEX "clients_companyId_idx" ON "clients"("companyId");
CREATE UNIQUE INDEX "clients_companyId_cpf_key" ON "clients"("companyId", "cpf");
CREATE INDEX "pets_companyId_idx" ON "pets"("companyId");
CREATE INDEX "services_companyId_idx" ON "services"("companyId");
CREATE INDEX "appointments_companyId_idx" ON "appointments"("companyId");
CREATE INDEX "medical_records_companyId_idx" ON "medical_records"("companyId");
CREATE INDEX "products_companyId_idx" ON "products"("companyId");
CREATE UNIQUE INDEX "products_companyId_sku_key" ON "products"("companyId", "sku");
CREATE UNIQUE INDEX "products_companyId_barcode_key" ON "products"("companyId", "barcode");
CREATE INDEX "sales_companyId_idx" ON "sales"("companyId");
CREATE INDEX "financial_entries_companyId_idx" ON "financial_entries"("companyId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clients" ADD CONSTRAINT "clients_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "pets" ADD CONSTRAINT "pets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "financial_entries" ADD CONSTRAINT "financial_entries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
