-- AlterTable Note : ajout couleur fond/texte, rappel, expiration
ALTER TABLE "Note" ADD COLUMN "couleurFond" TEXT NOT NULL DEFAULT '#fef08a';
ALTER TABLE "Note" ADD COLUMN "couleurTexte" TEXT NOT NULL DEFAULT '#1f2937';
ALTER TABLE "Note" ADD COLUMN "rappelAt" DATETIME;
ALTER TABLE "Note" ADD COLUMN "rappelEnvoye" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Note" ADD COLUMN "expirationAt" DATETIME;
