-- Migration: mail_module
-- Remplace les anciens modèles BoiteMail / RegleMail / EmailLog par la nouvelle version

-- Supprimer l'ancienne table RegleMail (plus utilisée)
DROP TABLE IF EXISTS "RegleMail";

-- Recréer BoiteMail avec tous les nouveaux champs
DROP TABLE IF EXISTS "EmailLog";
DROP TABLE IF EXISTS "BoiteMail";

CREATE TABLE "BoiteMail" (
    "id"                    INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nom"                   TEXT NOT NULL,
    "email"                 TEXT NOT NULL,
    "provider"              TEXT NOT NULL,
    "actif"                 BOOLEAN NOT NULL DEFAULT 1,
    "imapHost"              TEXT NOT NULL DEFAULT '',
    "imapPort"              INTEGER NOT NULL DEFAULT 993,
    "imapLogin"             TEXT NOT NULL DEFAULT '',
    "imapPassword"          TEXT NOT NULL DEFAULT '',
    "smtpHost"              TEXT NOT NULL DEFAULT '',
    "smtpPort"              INTEGER NOT NULL DEFAULT 587,
    "smtpLogin"             TEXT NOT NULL DEFAULT '',
    "smtpPassword"          TEXT NOT NULL DEFAULT '',
    "scanNonLuSeulement"    BOOLEAN NOT NULL DEFAULT 1,
    "scanNombre"            INTEGER NOT NULL DEFAULT 20,
    "instructionSpecifique" TEXT NOT NULL DEFAULT '',
    "salonDiscordRapport"   TEXT NOT NULL DEFAULT '',
    "createdAt"             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"             DATETIME NOT NULL
);

CREATE UNIQUE INDEX "BoiteMail_email_key" ON "BoiteMail"("email");

CREATE TABLE "EmailLog" (
    "id"               INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "boiteMailId"      INTEGER NOT NULL,
    "uid"              INTEGER,
    "sujet"            TEXT,
    "expediteur"       TEXT,
    "corps"            TEXT,
    "dossier"          TEXT,
    "categorie"        TEXT,
    "action"           TEXT,
    "raison"           TEXT,
    "actionAppliquee"  BOOLEAN NOT NULL DEFAULT 0,
    "brouillon"        TEXT,
    "brouillonEnvoye"  BOOLEAN NOT NULL DEFAULT 0,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_boiteMailId_fkey" FOREIGN KEY ("boiteMailId") REFERENCES "BoiteMail" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
