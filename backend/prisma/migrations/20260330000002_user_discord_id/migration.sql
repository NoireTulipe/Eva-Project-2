ALTER TABLE "User" ADD COLUMN "discordId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "User_discordId_key" ON "User"("discordId");
