/*
  Warnings:

  - Added the required column `shop` to the `models` table without a default value. This is not possible if the table is not empty.

  Migration strategy:
  - Existing rows will have shop set to 'unknown' (these are from development)
  - Going forward, all new models will require a shop value
*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_models" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shop" TEXT NOT NULL,
    "model_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
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
-- Copy existing data with 'unknown' as default shop value
INSERT INTO "new_models" ("created_at", "currency", "designer_url", "id", "model_id", "price", "product_id", "product_name", "shopify_product_gid", "shopify_variant_gid", "source", "updated_at", "variant_id", "shop") 
SELECT "created_at", "currency", "designer_url", "id", "model_id", "price", "product_id", "product_name", "shopify_product_gid", "shopify_variant_gid", "source", "updated_at", "variant_id", 'unknown' 
FROM "models";
DROP TABLE "models";
ALTER TABLE "new_models" RENAME TO "models";
CREATE UNIQUE INDEX "models_model_id_key" ON "models"("model_id");
CREATE INDEX "models_shop_idx" ON "models"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
