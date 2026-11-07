-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "reminder24hSentAt" TIMESTAMP(3),
ADD COLUMN     "reminder3hSentAt" TIMESTAMP(3);
