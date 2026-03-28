-- CreateTable
CREATE TABLE "ConfigParam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Prompt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "module" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "contenu" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CronConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "ConfigParam_cle_key" ON "ConfigParam"("cle");

-- CreateIndex
CREATE UNIQUE INDEX "Prompt_module_role_key" ON "Prompt"("module", "role");

-- CreateIndex
CREATE UNIQUE INDEX "CronConfig_nom_key" ON "CronConfig"("nom");
