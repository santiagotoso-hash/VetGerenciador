-- AlterTable
ALTER TABLE "companies" ADD COLUMN "logo" TEXT;

-- Logomarca da VilaPet by Mary (arquivo em front/public/assets/vilapet-by-mary/)
UPDATE "companies" SET "logo" = '/assets/vilapet-by-mary/logo.jpg' WHERE "slug" = 'vilapet-by-mary';
