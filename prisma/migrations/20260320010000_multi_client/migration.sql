-- DropIndex: remove unique constraint on Client.userId to allow multiple clients per user
DROP INDEX IF EXISTS "Client_userId_key";

-- CreateIndex: add a non-unique index on userId for query performance
CREATE INDEX "Client_userId_idx" ON "Client"("userId");
