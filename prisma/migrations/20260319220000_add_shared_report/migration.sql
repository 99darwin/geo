-- CreateTable
CREATE TABLE "SharedReport" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SharedReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SharedReport_token_key" ON "SharedReport"("token");

-- CreateIndex
CREATE INDEX "SharedReport_expiresAt_idx" ON "SharedReport"("expiresAt");
