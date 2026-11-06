-- CreateTable
CREATE TABLE "AppointmentStatusHistory" (
    "id" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "fromStatus" "AppointmentStatus" NOT NULL,
    "toStatus" "AppointmentStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" TEXT NOT NULL DEFAULT 'system',

    CONSTRAINT "AppointmentStatusHistory_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AppointmentStatusHistory" ADD CONSTRAINT "AppointmentStatusHistory_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
