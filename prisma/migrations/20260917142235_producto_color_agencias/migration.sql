-- AlterTable
ALTER TABLE "products" ADD COLUMN     "color" VARCHAR(50),
ADD COLUMN     "shipping_agencies" VARCHAR(30)[] DEFAULT ARRAY[]::VARCHAR(30)[];
