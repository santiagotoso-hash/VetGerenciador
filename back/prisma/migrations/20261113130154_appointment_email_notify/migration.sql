-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "notifyClient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
