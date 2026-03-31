-- Migration: emaillog_correction
-- Ajout des champs de correction humaine sur EmailLog

ALTER TABLE "EmailLog" ADD COLUMN "corrige"          BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "EmailLog" ADD COLUMN "correctionAction" TEXT;
ALTER TABLE "EmailLog" ADD COLUMN "correctionRaison" TEXT;
