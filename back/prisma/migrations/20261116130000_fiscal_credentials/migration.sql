-- Credenciais fiscais por empresa (certificado A1 e CSC), guardadas cifradas.

-- AlterTable
ALTER TABLE "companies" ADD COLUMN "fiscalCertificate" TEXT,
ADD COLUMN "fiscalCertificatePassword" TEXT,
ADD COLUMN "fiscalCertificateName" TEXT,
ADD COLUMN "fiscalCertificateExpiresAt" TIMESTAMP(3),
ADD COLUMN "fiscalCscId" TEXT,
ADD COLUMN "fiscalCscToken" TEXT;
