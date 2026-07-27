-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
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
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,
    "serviceFloors" INTEGER NOT NULL,
    "apartmentsPerFloor" INTEGER NOT NULL,
    "elevators" INTEGER NOT NULL DEFAULT 0,
    "waterPumps" INTEGER NOT NULL DEFAULT 0,
    "firePump" BOOLEAN NOT NULL DEFAULT false,
    "mechanicalLoads" TEXT,
    "splitAc" INTEGER NOT NULL DEFAULT 0,
    "centralAc" REAL NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "ApartmentTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "area" REAL NOT NULL,
    "loadDensity" REAL NOT NULL,
    "connectedLoad" REAL NOT NULL,
    "breakerSize" TEXT,
    "cableSize" TEXT,
    "repeatCount" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "ApartmentTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoadLibraryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "power" REAL NOT NULL,
    "voltage" REAL NOT NULL DEFAULT 230,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "powerFactor" REAL NOT NULL DEFAULT 0.85,
    "demandFactor" REAL NOT NULL DEFAULT 1.0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "runningCurrent" REAL NOT NULL DEFAULT 0,
    "startingCurrent" REAL,
    "notes" TEXT,
    "projectId" TEXT NOT NULL,
    CONSTRAINT "LoadLibraryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FloorDesign" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "floorNumber" INTEGER NOT NULL,
    "buildingId" TEXT NOT NULL,
    CONSTRAINT "FloorDesign_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FloorItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apartmentTemplateId" TEXT,
    "floorDesignId" TEXT NOT NULL,
    "calculatedConnectedLoad" REAL NOT NULL DEFAULT 0,
    "calculatedMaxDemand" REAL NOT NULL DEFAULT 0,
    "calculatedCurrent" REAL NOT NULL DEFAULT 0,
    "breakerSize" TEXT,
    "cableSize" TEXT,
    "voltageDrop" REAL,
    CONSTRAINT "FloorItem_apartmentTemplateId_fkey" FOREIGN KEY ("apartmentTemplateId") REFERENCES "ApartmentTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FloorItem_floorDesignId_fkey" FOREIGN KEY ("floorDesignId") REFERENCES "FloorDesign" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EquipmentCatalog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ratedCurrent" REAL NOT NULL,
    "poles" INTEGER NOT NULL DEFAULT 3,
    "breakingCapacity" REAL NOT NULL,
    "tripUnit" TEXT,
    "settingsJson" TEXT,
    "datasheetUrl" TEXT
);

-- CreateTable
CREATE TABLE "BreakerSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "breakerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "frameSize" TEXT NOT NULL,
    "ir" REAL NOT NULL,
    "tr" REAL NOT NULL,
    "isd" REAL,
    "tsd" REAL,
    "i2t" BOOLEAN,
    "ii" REAL,
    "ig" REAL,
    "tg" REAL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "BreakerSettings_breakerId_key" ON "BreakerSettings"("breakerId");
