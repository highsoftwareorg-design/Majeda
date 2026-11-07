-- CreateTable
CREATE TABLE "ConsentOverride" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedBy" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsentOverride_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ConsentOverride" ADD CONSTRAINT "ConsentOverride_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
