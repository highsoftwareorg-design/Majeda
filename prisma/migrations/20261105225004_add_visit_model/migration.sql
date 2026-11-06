-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "therapist" TEXT,
    "treatedArea" TEXT,
    "notes" TEXT,
    "price" DECIMAL(65,30),
    "products" TEXT,
    "parameters" TEXT,
    "returnDate" TIMESTAMP(3),
    "returnNoteHandled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitTreatment" (
    "visitId" TEXT NOT NULL,
    "treatmentId" TEXT NOT NULL,

    CONSTRAINT "VisitTreatment_pkey" PRIMARY KEY ("visitId","treatmentId")
);

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitTreatment" ADD CONSTRAINT "VisitTreatment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitTreatment" ADD CONSTRAINT "VisitTreatment_treatmentId_fkey" FOREIGN KEY ("treatmentId") REFERENCES "Treatment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
