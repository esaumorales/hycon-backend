-- Partes que cada usuario ya vio. Con todas las del curso se gana el certificado.
CREATE TABLE IF NOT EXISTS "lesson_progress" (
  "lesson_progress_id" SERIAL PRIMARY KEY,
  "user_id" INTEGER NOT NULL REFERENCES "users"("user_id"),
  "lesson_id" INTEGER NOT NULL REFERENCES "lessons"("lesson_id"),
  "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Una sola marca por usuario y parte: volver a verla no duplica nada
CREATE UNIQUE INDEX IF NOT EXISTS "lesson_progress_user_id_lesson_id_key"
  ON "lesson_progress"("user_id", "lesson_id");
CREATE INDEX IF NOT EXISTS "lesson_progress_user_id_idx" ON "lesson_progress"("user_id");

-- El nombre con el que se emitio el certificado. La tabla estaba sin usar, por eso
-- el valor por defecto vacio no afecta a nadie.
ALTER TABLE "certificates" ADD COLUMN IF NOT EXISTS "holder_name" VARCHAR(150) NOT NULL DEFAULT '';
