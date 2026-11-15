-- Cobrança de empresas (financeiro do superadmin). Tudo opcional: empresas existentes ficam "sem cobrança".

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "trialEndsAt" TIMESTAMP(3),
ADD COLUMN "paidUntil" DATE,
ADD COLUMN "monthlyFeeCents" INTEGER,
ADD COLUMN "billingStartDate" DATE,
ADD COLUMN "billingEmail" TEXT,
ADD COLUMN "billingDay" INTEGER,
ADD COLUMN "billingLastSentMonth" TEXT;

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "paidAt" DATE NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "method" TEXT NOT NULL,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payments_companyId_periodEnd_idx" ON "payments"("companyId", "periodEnd");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
