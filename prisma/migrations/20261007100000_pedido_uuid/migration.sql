-- Identificador publico del pedido
ALTER TABLE "orders" ADD COLUMN "uuid" UUID;
UPDATE "orders" SET "uuid" = gen_random_uuid() WHERE "uuid" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "uuid" SET NOT NULL;
CREATE UNIQUE INDEX "orders_uuid_key" ON "orders"("uuid");
