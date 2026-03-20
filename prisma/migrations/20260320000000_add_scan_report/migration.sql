-- CreateTable
CREATE TABLE "ScanReport" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScanReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanReport_clientId_idx" ON "ScanReport"("clientId");

-- CreateIndex
CREATE INDEX "ScanReport_clientId_createdAt_idx" ON "ScanReport"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ScanReport" ADD CONSTRAINT "ScanReport_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
