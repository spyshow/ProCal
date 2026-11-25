-- Add missing foreign-key and composite indexes across core project hierarchy tables (PERF-003)
CREATE INDEX IF NOT EXISTS "Building_projectId_idx" ON "Building"("projectId");
CREATE INDEX IF NOT EXISTS "BuildingLoad_buildingId_idx" ON "BuildingLoad"("buildingId");
CREATE INDEX IF NOT EXISTS "BuildingLoad_loadLibraryItemId_idx" ON "BuildingLoad"("loadLibraryItemId");
CREATE INDEX IF NOT EXISTS "ApartmentTemplate_projectId_idx" ON "ApartmentTemplate"("projectId");
CREATE INDEX IF NOT EXISTS "ApartmentRoom_templateId_idx" ON "ApartmentRoom"("templateId");
CREATE INDEX IF NOT EXISTS "LoadLibraryItem_projectId_idx" ON "LoadLibraryItem"("projectId");
CREATE INDEX IF NOT EXISTS "FloorDesign_buildingId_floorNumber_idx" ON "FloorDesign"("buildingId", "floorNumber");
CREATE INDEX IF NOT EXISTS "FloorItem_floorDesignId_idx" ON "FloorItem"("floorDesignId");
CREATE INDEX IF NOT EXISTS "FloorItem_apartmentTemplateId_idx" ON "FloorItem"("apartmentTemplateId");
CREATE INDEX IF NOT EXISTS "FloorItem_loadLibraryItemId_idx" ON "FloorItem"("loadLibraryItemId");
