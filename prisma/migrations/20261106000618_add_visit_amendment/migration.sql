-- CreateTable
CREATE TABLE "VisitAmendment" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "editedBy" TEXT NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitAmendment_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VisitAmendment" ADD CONSTRAINT "VisitAmendment_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
