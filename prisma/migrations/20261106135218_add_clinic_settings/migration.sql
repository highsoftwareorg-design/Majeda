-- CreateTable
CREATE TABLE "ClinicSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "openHour" INTEGER NOT NULL DEFAULT 8,
    "closeHour" INTEGER NOT NULL DEFAULT 21,
    "breakStartHour" INTEGER,
    "breakStartMin" INTEGER DEFAULT 0,
    "breakEndHour" INTEGER,
    "breakEndMin" INTEGER DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSettings_pkey" PRIMARY KEY ("id")
);
