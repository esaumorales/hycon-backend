-- Identificador publico de cursos y productos: se anade opcional, se rellena y luego se exige
ALTER TABLE "courses" ADD COLUMN "uuid" UUID;
UPDATE "courses" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "courses" ALTER COLUMN "uuid" SET NOT NULL;
CREATE UNIQUE INDEX "courses_uuid_key" ON "courses"("uuid");

ALTER TABLE "products" ADD COLUMN "uuid" UUID;
UPDATE "products" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "products" ALTER COLUMN "uuid" SET NOT NULL;
CREATE UNIQUE INDEX "products_uuid_key" ON "products"("uuid");
