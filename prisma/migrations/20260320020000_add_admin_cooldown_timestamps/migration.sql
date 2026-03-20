-- Add cooldown timestamp columns for admin recheck/regenerate actions
ALTER TABLE "Client" ADD COLUMN "lastRecheckAt" TIMESTAMP(3);
ALTER TABLE "Client" ADD COLUMN "lastRegenerateAt" TIMESTAMP(3);
