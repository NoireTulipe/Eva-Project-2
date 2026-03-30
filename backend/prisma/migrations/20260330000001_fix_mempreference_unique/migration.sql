-- Supprimer les doublons éventuels (garder le plus récent)
DELETE FROM MemPreference
WHERE id NOT IN (
  SELECT MAX(id)
  FROM MemPreference
  GROUP BY userId, cle
);

-- Créer l'index unique
CREATE UNIQUE INDEX IF NOT EXISTS "MemPreference_userId_cle_key" ON "MemPreference"("userId", "cle");
