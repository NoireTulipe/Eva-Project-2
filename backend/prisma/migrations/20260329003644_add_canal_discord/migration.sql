-- CreateTable
CREATE TABLE "CanalDiscord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "channelId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'conversation',
    "categories" TEXT NOT NULL DEFAULT '[]',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CanalDiscord_channelId_key" ON "CanalDiscord"("channelId");
