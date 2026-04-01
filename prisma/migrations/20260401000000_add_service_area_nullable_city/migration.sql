-- AlterTable
ALTER TABLE "Client" ALTER COLUMN "city" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "serviceArea" TEXT DEFAULT 'local';
