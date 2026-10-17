-- Solicitudes de cotizacion de evaluaciones ergonomicas
CREATE TABLE "quote_requests" (
  "quote_id" SERIAL NOT NULL,
  "uuid" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "company" VARCHAR(150),
  "phone" VARCHAR(30) NOT NULL,
  "email" VARCHAR(150) NOT NULL,
  "message" TEXT,
  "evaluations" VARCHAR(40)[] NOT NULL,
  "total" DECIMAL(10,2) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'nuevo',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quote_requests_pkey" PRIMARY KEY ("quote_id")
);

CREATE UNIQUE INDEX "quote_requests_uuid_key" ON "quote_requests"("uuid");
CREATE INDEX "quote_requests_created_at_idx" ON "quote_requests"("created_at");
