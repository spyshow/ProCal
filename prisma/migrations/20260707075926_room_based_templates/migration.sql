/*
  Warnings:

  - You are about to drop the column `area` on the `ApartmentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `breakerSize` on the `ApartmentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `cableSize` on the `ApartmentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `connectedLoad` on the `ApartmentTemplate` table. All the data in the column will be lost.
  - You are about to drop the column `loadDensity` on the `ApartmentTemplate` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `ApartmentTemplate` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "ApartmentRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" REAL NOT NULL,
    "hasAc" BOOLEAN NOT NULL DEFAULT false,
    "acBtu" INTEGER,
    "loadDensity" REAL NOT NULL,
    "connectedLoad" REAL NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "ApartmentRoom_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApartmentTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ApartmentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "repeatCount" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ApartmentTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ApartmentTemplate" ("id", "name", "projectId", "repeatCount") SELECT "id", "name", "projectId", "repeatCount" FROM "ApartmentTemplate";
DROP TABLE "ApartmentTemplate";
ALTER TABLE "new_ApartmentTemplate" RENAME TO "ApartmentTemplate";
CREATE TABLE "new_FloorItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apartmentTemplateId" TEXT,
    "loadLibraryItemId" TEXT,
    "floorDesignId" TEXT NOT NULL,
    "calculatedConnectedLoad" REAL NOT NULL DEFAULT 0,
    "calculatedMaxDemand" REAL NOT NULL DEFAULT 0,
    "calculatedCurrent" REAL NOT NULL DEFAULT 0,
    "breakerSize" TEXT,
    "cableSize" TEXT,
    "voltageDrop" REAL,
    CONSTRAINT "FloorItem_apartmentTemplateId_fkey" FOREIGN KEY ("apartmentTemplateId") REFERENCES "ApartmentTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FloorItem_loadLibraryItemId_fkey" FOREIGN KEY ("loadLibraryItemId") REFERENCES "LoadLibraryItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FloorItem_floorDesignId_fkey" FOREIGN KEY ("floorDesignId") REFERENCES "FloorDesign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FloorItem" ("apartmentTemplateId", "breakerSize", "cableSize", "calculatedConnectedLoad", "calculatedCurrent", "calculatedMaxDemand", "floorDesignId", "id", "name", "type", "voltageDrop") SELECT "apartmentTemplateId", "breakerSize", "cableSize", "calculatedConnectedLoad", "calculatedCurrent", "calculatedMaxDemand", "floorDesignId", "id", "name", "type", "voltageDrop" FROM "FloorItem";
DROP TABLE "FloorItem";
ALTER TABLE "new_FloorItem" RENAME TO "FloorItem";
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
    "country" TEXT NOT NULL DEFAULT 'Syria',
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("client", "consultant", "contractor", "createdAt", "date", "engineer", "frequency", "id", "location", "maxDemandFactor", "name", "notes", "powerFactor", "preferredManufacturer", "transformerSize", "updatedAt", "userId", "voltage") SELECT "client", "consultant", "contractor", "createdAt", "date", "engineer", "frequency", "id", "location", "maxDemandFactor", "name", "notes", "powerFactor", "preferredManufacturer", "transformerSize", "updatedAt", "userId", "voltage" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
