-- Dados cadastrais da empresa, dados do proprietário e último acesso dos usuários.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "cnpj" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "email" TEXT,
ADD COLUMN "address" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "state" TEXT,
ADD COLUMN "zipCode" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "ownerName" TEXT,
ADD COLUMN "ownerEmail" TEXT,
ADD COLUMN "ownerPhone" TEXT,
ADD COLUMN "ownerDocument" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "lastLoginAt" TIMESTAMP(3);
