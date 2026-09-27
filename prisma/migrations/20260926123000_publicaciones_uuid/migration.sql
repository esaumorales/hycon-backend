-- Identificador publico de las publicaciones: se anade opcional, se rellena y luego se exige
ALTER TABLE "posts" ADD COLUMN "uuid" UUID;
UPDATE "posts" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "posts" ALTER COLUMN "uuid" SET NOT NULL;
CREATE UNIQUE INDEX "posts_uuid_key" ON "posts"("uuid");
