-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanStatus') THEN
        CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'PAST_DUE');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "planStatus" "PlanStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "planExpiresAt" TIMESTAMP(3);
ALTER TABLE "Company" ADD COLUMN IF NOT EXISTS "mpPreapprovalId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "mpPreapprovalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Company_mpPreapprovalId_key" ON "Company"("mpPreapprovalId");
