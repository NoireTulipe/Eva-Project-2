-- CreateTable : MemRelation (types de relation normalisés par utilisateur)
CREATE TABLE "MemRelation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemRelation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable : junction MemContact <-> MemRelation (many-to-many)
CREATE TABLE "_MemContactToMemRelation" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_MemContactToMemRelation_A_fkey" FOREIGN KEY ("A") REFERENCES "MemContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MemContactToMemRelation_B_fkey" FOREIGN KEY ("B") REFERENCES "MemRelation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable : junction MemContact <-> MemSouvenir (many-to-many)
CREATE TABLE "_MemContactToMemSouvenir" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_MemContactToMemSouvenir_A_fkey" FOREIGN KEY ("A") REFERENCES "MemContact" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "_MemContactToMemSouvenir_B_fkey" FOREIGN KEY ("B") REFERENCES "MemSouvenir" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "MemRelation_userId_nom_key" ON "MemRelation"("userId", "nom");

-- CreateIndex
CREATE UNIQUE INDEX "_MemContactToMemRelation_AB_unique" ON "_MemContactToMemRelation"("A", "B");
CREATE INDEX "_MemContactToMemRelation_B_index" ON "_MemContactToMemRelation"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_MemContactToMemSouvenir_AB_unique" ON "_MemContactToMemSouvenir"("A", "B");
CREATE INDEX "_MemContactToMemSouvenir_B_index" ON "_MemContactToMemSouvenir"("B");
