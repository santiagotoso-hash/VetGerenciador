-- Checklist de implantação: itens confirmados à mão pelo superadmin.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "onboardingChecks" JSONB NOT NULL DEFAULT '{}';
