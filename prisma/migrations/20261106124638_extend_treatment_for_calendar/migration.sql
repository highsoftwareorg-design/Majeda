-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN     "authorizedTherapists" TEXT,
ADD COLUMN     "color" TEXT DEFAULT '#D2AB2E',
ADD COLUMN     "requiresConsentForm" BOOLEAN NOT NULL DEFAULT false;
