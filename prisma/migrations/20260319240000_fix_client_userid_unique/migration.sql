-- Drop the non-unique index and replace with a unique constraint
DROP INDEX IF EXISTS "Client_userId_idx";
CREATE UNIQUE INDEX "Client_userId_key" ON "Client"("userId");
