-- Esqueci minha senha: hash do token, validade e data da última troca de senha.

-- AlterTable
ALTER TABLE "users" ADD COLUMN "passwordResetHash" TEXT,
ADD COLUMN "passwordResetExpires" TIMESTAMP(3),
ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
