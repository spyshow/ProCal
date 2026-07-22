/*
  Warnings:

  - You are about to drop the column `repeatCount` on the `ApartmentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `centralAc` on the `Building` table. All the data in the column will be lost.
  - You are about to drop the column `elevators` on the `Building` table. All the data in the column will be lost.
  - You are about to drop the column `firePump` on the `Building` table. All the data in the column will be lost.
  - You are about to drop the column `splitAc` on the `Building` table. All the data in the column will be lost.
  - You are about to drop the column `waterPumps` on the `Building` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "FloorItem" ADD COLUMN "assignedPhase" INTEGER;
ALTER TABLE "FloorItem" ADD COLUMN "cableInsulation" TEXT DEFAULT 'XLPE';
ALTER TABLE "FloorItem" ADD COLUMN "cableLength" REAL;
ALTER TABLE "FloorItem" ADD COLUMN "installMethod" TEXT DEFAULT 'C';

-- CreateTable
CREATE TABLE "BuildingLoad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "buildingId" TEXT NOT NULL,
    "loadLibraryItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cableSize" TEXT,
    "cableLength" REAL,
    "installMethod" TEXT,
    "cableInsulation" TEXT,
    "assignedPhase" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BuildingLoad_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BuildingLoad_loadLibraryItemId_fkey" FOREIGN KEY ("loadLibraryItemId") REFERENCES "LoadLibraryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApartmentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phases" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApartmentTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApartmentTemplate" ("createdAt", "id", "name", "projectId", "updatedAt") SELECT "createdAt", "id", "name", "projectId", "updatedAt" FROM "ApartmentTemplate";
DROP TABLE "ApartmentTemplate";
ALTER TABLE "new_ApartmentTemplate" RENAME TO "ApartmentTemplate";
CREATE TABLE "new_BreakerFamily" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "manufacturer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BreakerFamily" ("category", "createdAt", "id", "manufacturer", "name", "updatedAt") SELECT "category", "createdAt", "id", "manufacturer", "name", "updatedAt" FROM "BreakerFamily";
DROP TABLE "BreakerFamily";
ALTER TABLE "new_BreakerFamily" RENAME TO "BreakerFamily";
CREATE UNIQUE INDEX "BreakerFamily_manufacturer_category_name_key" ON "BreakerFamily"("manufacturer", "category", "name");
CREATE TABLE "new_Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,
    "serviceFloors" INTEGER NOT NULL,
    "apartmentsPerFloor" INTEGER NOT NULL,
    "mechanicalLoads" TEXT,
    "generator" REAL,
    "transformer" REAL,
    "supplyVoltage" TEXT NOT NULL DEFAULT '400V 3-Phase',
    "earthingSystem" TEXT NOT NULL DEFAULT 'TN-S',
    "lightningProtection" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Building_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Building" ("apartmentsPerFloor", "createdAt", "earthingSystem", "floors", "generator", "id", "lightningProtection", "mechanicalLoads", "name", "projectId", "serviceFloors", "supplyVoltage", "transformer", "updatedAt") SELECT "apartmentsPerFloor", "createdAt", "earthingSystem", "floors", "generator", "id", "lightningProtection", "mechanicalLoads", "name", "projectId", "serviceFloors", "supplyVoltage", "transformer", "updatedAt" FROM "Building";
DROP TABLE "Building";
ALTER TABLE "new_Building" RENAME TO "Building";
CREATE TABLE "new_FloorDesign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorNumber" INTEGER NOT NULL,
    "hasFloorSubPanels" BOOLEAN NOT NULL DEFAULT false,
    "riserCableLength" REAL,
    "riserCableSize" TEXT,
    "buildingId" TEXT NOT NULL,
    CONSTRAINT "FloorDesign_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FloorDesign" ("buildingId", "floorNumber", "id") SELECT "buildingId", "floorNumber", "id" FROM "FloorDesign";
DROP TABLE "FloorDesign";
ALTER TABLE "new_FloorDesign" RENAME TO "FloorDesign";
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "consultant" TEXT NOT NULL,
    "contractor" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "engineer" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "voltage" REAL NOT NULL DEFAULT 400,
    "frequency" REAL NOT NULL DEFAULT 50,
    "powerFactor" REAL NOT NULL DEFAULT 0.85,
    "maxDemandFactor" REAL NOT NULL DEFAULT 0.8,
    "transformerSize" REAL,
    "notes" TEXT,
    "preferredManufacturer" TEXT NOT NULL DEFAULT 'MIXED',
    "defaultAcbFamilyId" TEXT,
    "defaultMccbFamilyId" TEXT,
    "defaultMcbFamilyId" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Syria',
    "logoUrl" TEXT,
    "calculationStandard" TEXT NOT NULL DEFAULT 'IEC',
    "maxVoltageDropLighting" REAL NOT NULL DEFAULT 3,
    "maxVoltageDropPower" REAL NOT NULL DEFAULT 5,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_defaultAcbFamilyId_fkey" FOREIGN KEY ("defaultAcbFamilyId") REFERENCES "BreakerFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_defaultMccbFamilyId_fkey" FOREIGN KEY ("defaultMccbFamilyId") REFERENCES "BreakerFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_defaultMcbFamilyId_fkey" FOREIGN KEY ("defaultMcbFamilyId") REFERENCES "BreakerFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("client", "consultant", "contractor", "country", "createdAt", "date", "defaultAcbFamilyId", "defaultMcbFamilyId", "defaultMccbFamilyId", "engineer", "frequency", "id", "location", "logoUrl", "maxDemandFactor", "maxVoltageDropLighting", "maxVoltageDropPower", "name", "notes", "powerFactor", "preferredManufacturer", "transformerSize", "updatedAt", "userId", "voltage") SELECT "client", "consultant", "contractor", "country", "createdAt", "date", "defaultAcbFamilyId", "defaultMcbFamilyId", "defaultMccbFamilyId", "engineer", "frequency", "id", "location", "logoUrl", "maxDemandFactor", "maxVoltageDropLighting", "maxVoltageDropPower", "name", "notes", "powerFactor", "preferredManufacturer", "transformerSize", "updatedAt", "userId", "voltage" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex
DROP INDEX "EquipmentCatalog_catalogUniqueKey_idx";
CREATE UNIQUE INDEX "EquipmentCatalog_manufacturer_category_series_model_ratedCurrent_poles_key" ON "EquipmentCatalog"("manufacturer", "category", "series", "model", "ratedCurrent", "poles");
