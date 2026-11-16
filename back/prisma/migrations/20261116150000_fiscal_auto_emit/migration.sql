-- Opção por empresa: emitir a nota ao finalizar a venda.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "fiscalAutoEmit" BOOLEAN NOT NULL DEFAULT false;
