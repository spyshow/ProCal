-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "credits" INTEGER NOT NULL DEFAULT 0,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT NOT NULL,
    "consultant" TEXT NOT NULL,
    "contractor" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "engineer" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 400,
    "frequency" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "powerFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "maxDemandFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "transformerSize" DOUBLE PRECISION,
    "notes" TEXT,
    "preferredManufacturer" TEXT NOT NULL DEFAULT 'MIXED',
    "defaultAcbFamilyId" TEXT,
    "defaultMccbFamilyId" TEXT,
    "defaultMcbFamilyId" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Syria',
    "logoUrl" TEXT,
    "calculationStandard" TEXT NOT NULL DEFAULT 'IEC',
    "maxVoltageDropLighting" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "maxVoltageDropPower" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Building" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "floors" INTEGER NOT NULL,
    "serviceFloors" INTEGER NOT NULL,
    "apartmentsPerFloor" INTEGER NOT NULL,
    "mechanicalLoads" TEXT,
    "generator" DOUBLE PRECISION,
    "transformer" DOUBLE PRECISION,
    "supplyVoltage" TEXT NOT NULL DEFAULT '400V 3-Phase',
    "earthingSystem" TEXT NOT NULL DEFAULT 'TN-S',
    "lightningProtection" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuildingLoad" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "loadLibraryItemId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "cableSize" TEXT,
    "cableLength" DOUBLE PRECISION,
    "installMethod" TEXT,
    "cableInsulation" TEXT,
    "assignedPhase" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuildingLoad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApartmentTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phases" INTEGER NOT NULL DEFAULT 1,
    "projectId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApartmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApartmentRoom" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area" DOUBLE PRECISION NOT NULL,
    "hasAc" BOOLEAN NOT NULL DEFAULT false,
    "acBtu" INTEGER,
    "loadDensity" DOUBLE PRECISION NOT NULL,
    "connectedLoad" DOUBLE PRECISION NOT NULL,
    "templateId" TEXT NOT NULL,

    CONSTRAINT "ApartmentRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoadLibraryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "power" DOUBLE PRECISION NOT NULL,
    "voltage" DOUBLE PRECISION NOT NULL DEFAULT 230,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "powerFactor" DOUBLE PRECISION NOT NULL DEFAULT 0.85,
    "demandFactor" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "runningCurrent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startingCurrent" DOUBLE PRECISION,
    "notes" TEXT,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "LoadLibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorDesign" (
    "id" TEXT NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "hasFloorSubPanels" BOOLEAN NOT NULL DEFAULT false,
    "riserCableLength" DOUBLE PRECISION,
    "riserCableSize" TEXT,
    "buildingId" TEXT NOT NULL,

    CONSTRAINT "FloorDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FloorItem" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "apartmentTemplateId" TEXT,
    "loadLibraryItemId" TEXT,
    "floorDesignId" TEXT NOT NULL,
    "calculatedConnectedLoad" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedMaxDemand" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "calculatedCurrent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakerSize" TEXT,
    "cableSize" TEXT,
    "cableLength" DOUBLE PRECISION,
    "voltageDrop" DOUBLE PRECISION,
    "installMethod" TEXT DEFAULT 'C',
    "cableInsulation" TEXT DEFAULT 'XLPE',
    "assignedPhase" INTEGER,

    CONSTRAINT "FloorItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentCatalog" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "series" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "ratedCurrent" DOUBLE PRECISION NOT NULL,
    "poles" INTEGER NOT NULL DEFAULT 3,
    "breakingCapacity" DOUBLE PRECISION NOT NULL,
    "tripUnit" TEXT,
    "settingsJson" TEXT,
    "datasheetUrl" TEXT,
    "familyId" TEXT,

    CONSTRAINT "EquipmentCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakerFamily" (
    "id" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BreakerFamily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BreakerSettings" (
    "id" TEXT NOT NULL,
    "breakerId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "frameSize" TEXT NOT NULL,
    "ir" DOUBLE PRECISION NOT NULL,
    "tr" DOUBLE PRECISION NOT NULL,
    "isd" DOUBLE PRECISION,
    "tsd" DOUBLE PRECISION,
    "i2t" BOOLEAN,
    "ii" DOUBLE PRECISION,
    "ig" DOUBLE PRECISION,
    "tg" DOUBLE PRECISION,

    CONSTRAINT "BreakerSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "EquipmentCatalog_familyId_idx" ON "EquipmentCatalog"("familyId");

-- CreateIndex
CREATE UNIQUE INDEX "EquipmentCatalog_manufacturer_category_series_model_ratedCu_key" ON "EquipmentCatalog"("manufacturer", "category", "series", "model", "ratedCurrent", "poles");

-- CreateIndex
CREATE UNIQUE INDEX "BreakerFamily_manufacturer_category_name_key" ON "BreakerFamily"("manufacturer", "category", "name");

-- CreateIndex
CREATE UNIQUE INDEX "BreakerSettings_breakerId_key" ON "BreakerSettings"("breakerId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_defaultAcbFamilyId_fkey" FOREIGN KEY ("defaultAcbFamilyId") REFERENCES "BreakerFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_defaultMccbFamilyId_fkey" FOREIGN KEY ("defaultMccbFamilyId") REFERENCES "BreakerFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_defaultMcbFamilyId_fkey" FOREIGN KEY ("defaultMcbFamilyId") REFERENCES "BreakerFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Building" ADD CONSTRAINT "Building_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingLoad" ADD CONSTRAINT "BuildingLoad_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuildingLoad" ADD CONSTRAINT "BuildingLoad_loadLibraryItemId_fkey" FOREIGN KEY ("loadLibraryItemId") REFERENCES "LoadLibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentTemplate" ADD CONSTRAINT "ApartmentTemplate_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApartmentRoom" ADD CONSTRAINT "ApartmentRoom_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ApartmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoadLibraryItem" ADD CONSTRAINT "LoadLibraryItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorDesign" ADD CONSTRAINT "FloorDesign_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorItem" ADD CONSTRAINT "FloorItem_apartmentTemplateId_fkey" FOREIGN KEY ("apartmentTemplateId") REFERENCES "ApartmentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorItem" ADD CONSTRAINT "FloorItem_loadLibraryItemId_fkey" FOREIGN KEY ("loadLibraryItemId") REFERENCES "LoadLibraryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FloorItem" ADD CONSTRAINT "FloorItem_floorDesignId_fkey" FOREIGN KEY ("floorDesignId") REFERENCES "FloorDesign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentCatalog" ADD CONSTRAINT "EquipmentCatalog_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "BreakerFamily"("id") ON DELETE SET NULL ON UPDATE CASCADE;
