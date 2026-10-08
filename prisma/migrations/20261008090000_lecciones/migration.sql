-- Partes del curso y limite de la muestra gratuita
ALTER TABLE "courses" ADD COLUMN "preview_seconds" INTEGER NOT NULL DEFAULT 60;

CREATE TABLE "lessons" (
  "lesson_id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL,
  "course_id" INTEGER NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "video_url" VARCHAR(500),
  "duration_minutes" INTEGER,
  "position" INTEGER NOT NULL,
  "is_preview" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "lessons_pkey" PRIMARY KEY ("lesson_id")
);

CREATE UNIQUE INDEX "lessons_uuid_key" ON "lessons"("uuid");
CREATE INDEX "lessons_course_id_position_idx" ON "lessons"("course_id", "position");

ALTER TABLE "lessons" ADD CONSTRAINT "lessons_course_id_fkey"
  FOREIGN KEY ("course_id") REFERENCES "courses"("course_id") ON DELETE RESTRICT ON UPDATE CASCADE;
