-- Re-add timestamp columns to Project that were missing in this SQLite file.
-- SQLite cannot ADD COLUMN with a non-constant default, so recreate the table.
PRAGMA foreign_keys=OFF;

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
    "maxVoltageDropLighting" REAL NOT NULL DEFAULT 3,
    "maxVoltageDropPower" REAL NOT NULL DEFAULT 5,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_defaultAcbFamilyId_fkey" FOREIGN KEY ("defaultAcbFamilyId") REFERENCES "BreakerFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_defaultMccbFamilyId_fkey" FOREIGN KEY ("defaultMccbFamilyId") REFERENCES "BreakerFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Project_defaultMcbFamilyId_fkey" FOREIGN KEY ("defaultMcbFamilyId") REFERENCES "BreakerFamily" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

INSERT INTO "new_Project" (
    "id", "name", "client", "consultant", "contractor", "location", "engineer", "date",
    "voltage", "frequency", "powerFactor", "maxDemandFactor", "transformerSize", "notes",
    "preferredManufacturer", "defaultAcbFamilyId", "defaultMccbFamilyId", "defaultMcbFamilyId",
    "country", "logoUrl", "maxVoltageDropLighting", "maxVoltageDropPower", "userId"
) SELECT
    "id", "name", "client", "consultant", "contractor", "location", "engineer", "date",
    "voltage", "frequency", "powerFactor", "maxDemandFactor", "transformerSize", "notes",
    "preferredManufacturer", "defaultAcbFamilyId", "defaultMccbFamilyId", "defaultMcbFamilyId",
    "country", "logoUrl", "maxVoltageDropLighting", "maxVoltageDropPower", "userId"
FROM "Project";

DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";

PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
