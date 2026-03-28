-- CreateTable
CREATE TABLE "TypeContact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Categorie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TypePDV" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TypeHorsStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TypePerte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "TypeFrais" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MethodePaiement" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "email" TEXT,
    "telephone" TEXT,
    "description" TEXT,
    "typeId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contact_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "TypeContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Auteur" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "prenom" TEXT,
    "email" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Produit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "description" TEXT,
    "categorieId" INTEGER NOT NULL,
    "prixVenteTTC" REAL NOT NULL,
    "tva" REAL NOT NULL DEFAULT 0,
    "cout" REAL NOT NULL,
    "droitAuteur" BOOLEAN NOT NULL DEFAULT false,
    "droitAuteurPourcent" REAL NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "stockAlerte" INTEGER NOT NULL DEFAULT 5,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Produit_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "Categorie" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuteurProduit" (
    "auteurId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,

    PRIMARY KEY ("auteurId", "produitId"),
    CONSTRAINT "AuteurProduit_auteurId_fkey" FOREIGN KEY ("auteurId") REFERENCES "Auteur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AuteurProduit_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MouvementHorsStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produitId" INTEGER NOT NULL,
    "typeHorsStockId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MouvementHorsStock_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MouvementHorsStock_typeHorsStockId_fkey" FOREIGN KEY ("typeHorsStockId") REFERENCES "TypeHorsStock" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Perte" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "typePerteid" INTEGER NOT NULL,
    "produitId" INTEGER,
    "quantite" INTEGER,
    "valeur" REAL NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Perte_typePerteid_fkey" FOREIGN KEY ("typePerteid") REFERENCES "TypePerte" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Perte_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Frais" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "typeFraisId" INTEGER NOT NULL,
    "libelle" TEXT NOT NULL,
    "montant" REAL NOT NULL,
    "sessionId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Frais_typeFraisId_fkey" FOREIGN KEY ("typeFraisId") REFERENCES "TypeFrais" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Frais_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PointDeVente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom" TEXT NOT NULL,
    "adresse" TEXT,
    "ville" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "typePDVId" INTEGER NOT NULL,
    "contactId" INTEGER,
    "commissionFixe" REAL NOT NULL DEFAULT 0,
    "commissionPourcent" REAL NOT NULL DEFAULT 0,
    "typeEncaissement" TEXT NOT NULL DEFAULT 'nous',
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PointDeVente_typePDVId_fkey" FOREIGN KEY ("typePDVId") REFERENCES "TypePDV" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PointDeVente_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Depot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "produitId" INTEGER NOT NULL,
    "pointDeVenteId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "quantiteVendue" INTEGER NOT NULL DEFAULT 0,
    "dateDepot" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateRetour" DATETIME,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    CONSTRAINT "Depot_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Depot_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pointDeVenteId" INTEGER NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ouverte',
    "remiseGlobale" REAL NOT NULL DEFAULT 0,
    "debut" DATETIME NOT NULL,
    "fin" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Session_pointDeVenteId_fkey" FOREIGN KEY ("pointDeVenteId") REFERENCES "PointDeVente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Vente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" INTEGER,
    "methodePaiementId" INTEGER,
    "type" TEXT NOT NULL DEFAULT 'session',
    "annulee" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Vente_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Vente_methodePaiementId_fkey" FOREIGN KEY ("methodePaiementId") REFERENCES "MethodePaiement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LigneVente" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "venteId" INTEGER NOT NULL,
    "produitId" INTEGER NOT NULL,
    "quantite" INTEGER NOT NULL,
    "prixUnitaire" REAL NOT NULL,
    "remise" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LigneVente_venteId_fkey" FOREIGN KEY ("venteId") REFERENCES "Vente" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LigneVente_produitId_fkey" FOREIGN KEY ("produitId") REFERENCES "Produit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TypeContact_nom_key" ON "TypeContact"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "Categorie_nom_key" ON "Categorie"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "TypePDV_nom_key" ON "TypePDV"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "TypeHorsStock_nom_key" ON "TypeHorsStock"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "TypePerte_nom_key" ON "TypePerte"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "TypeFrais_nom_key" ON "TypeFrais"("nom");

-- CreateIndex
CREATE UNIQUE INDEX "MethodePaiement_nom_key" ON "MethodePaiement"("nom");
