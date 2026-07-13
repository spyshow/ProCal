-- Add composite unique index on EquipmentCatalog to support idempotent CSV imports
CREATE UNIQUE INDEX IF NOT EXISTS "EquipmentCatalog_catalogUniqueKey_idx"
ON "EquipmentCatalog" ("manufacturer", "category", "series", "model", "ratedCurrent", "poles");
