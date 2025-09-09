/*
  Warnings:

  - You are about to alter the column `product_id` on the `models` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `variant_id` on the `models` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_models" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "model_id" TEXT NOT NULL,
    "product_id" BIGINT NOT NULL,
    "variant_id" BIGINT NOT NULL,
    "product_name" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "source" TEXT NOT NULL DEFAULT 'shop-page',
    "designer_url" TEXT NOT NULL,
    "shopify_product_gid" TEXT NOT NULL,
    "shopify_variant_gid" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_models" ("created_at", "currency", "designer_url", "id", "model_id", "price", "product_id", "product_name", "shopify_product_gid", "shopify_variant_gid", "source", "updated_at", "variant_id") SELECT "created_at", "currency", "designer_url", "id", "model_id", "price", "product_id", "product_name", "shopify_product_gid", "shopify_variant_gid", "source", "updated_at", "variant_id" FROM "models";
DROP TABLE "models";
ALTER TABLE "new_models" RENAME TO "models";
CREATE UNIQUE INDEX "models_model_id_key" ON "models"("model_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
