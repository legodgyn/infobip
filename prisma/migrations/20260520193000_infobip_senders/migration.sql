-- CreateTable
CREATE TABLE IF NOT EXISTS "InfobipSender" (
    "sender" TEXT NOT NULL,
    "displayName" TEXT,
    "status" TEXT,
    "raw" JSONB,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InfobipSender_pkey" PRIMARY KEY ("sender")
);
