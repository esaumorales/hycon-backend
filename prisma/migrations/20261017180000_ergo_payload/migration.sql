-- Las fichas conservan respuestas, factores y resultados opcionales en un documento.
-- IF NOT EXISTS permite actualizar instalaciones donde esta columna se añadió manualmente.
ALTER TABLE "forms" ADD COLUMN IF NOT EXISTS "payload" JSONB;
