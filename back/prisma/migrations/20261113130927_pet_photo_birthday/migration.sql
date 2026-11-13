-- AlterTable
ALTER TABLE "pets" ADD COLUMN     "birthdayEmail" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "birthdayEmailYear" INTEGER,
ADD COLUMN     "photo" TEXT;
