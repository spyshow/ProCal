# Data model reference

Prisma schema backing ProCal. Source of truth: `prisma/schema.prisma`. Every
claim here is traceable to that file. The generated client lives at
`src/generated/prisma` and is imported as `from "../generated/prisma/client"`
(see `src/lib/db.ts`).

## Generator & datasource

```prisma
generator client {
  provider = "prisma-client"     // Prisma 7 client generator
  output   = "../src/generated/prisma"
}
datasource db {
  provider = "postgresql"          // driver adapter @prisma/adapter-pg at runtime
}
```

> **Prisma 7 gotcha.** `npx prisma migrate dev` does **not** regenerate the
> client in Prisma 7 — you must run `npx prisma generate` afterward. The
> connection uses the `PrismaPg` driver adapter bound to `process.env.DATABASE_URL`
> (config in `prisma.config.ts`), not the legacy URL-in-schema datasource.

## Entity graph

```
User ─┬─ Project ─┬─ Building ─┬─ FloorDesign ── FloorItem
      │           │            └─ BuildingLoad
      │           ├─ ApartmentTemplate ── ApartmentRoom
      │           └─ LoadLibraryItem
      └─ ContactRequest
EquipmentCatalog ── BreakerFamily
  (referenced by Project.defaultAcb/Mccb/McbFamily)
BreakerSettings            (per-feeder protection settings, standalone)
```

## Enums-as-strings convention

ProCal stores constrained enumerations as `String` columns (Postgres-native
`enum` types are paired in comments). The TS layer narrows to a union. This is
a portability choice — the same schema runs against SQLite for local dev via
the `@prisma/adapter-better-sqlite3` dep. Examples: `role` (`"USER"|"ADMIN"`),
`ContactRequest.status` (`"OPEN"|"CLOSED"`), `preferredManufacturer`
(`"ABB"|"SCHNEIDER"|"MIXED"`), `calculationStandard` (`"IEC"|"NEMA"`).

## User

The authenticated account. Carries credits and the soft-delete flag.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `username` | `String` | — | `@unique` |
| `passwordHash` | `String` | — | bcryptjs hash |
| `name` | `String` | — | display name |
| `email` | `String?` | — | collected at signup; pre-fills `/billing`, SMTP `Reply-To` |
| `role` | `String` | `"USER"` | `"USER" \| "ADMIN"` — gates `/api/admin/*` |
| `credits` | `Int` | `0` | project credits; decremented on project create |
| `disabled` | `Boolean` | `false` | soft-delete; preserves project history |
| `createdAt` | `DateTime` | `now()` | |
| `projects` | `Project[]` | — | back-relation (Cascade delete) |
| `contactRequests` | `ContactRequest[]` | — | back-relation (Restrict delete) |

## ContactRequest

The captured-lead billing request row. One `OPEN` per user, enforced in-app
(CQ-C, pure-Prisma `findFirst` — no partial unique index).

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `userId` | `String` | — | FK → `User.id` (`onDelete: Restrict`) |
| `user` | `User` | — | relation |
| `email` | `String?` | — | denormalized snapshot of the requester's email at submit time |
| `message` | `String` | — | trimmed, capped at 4000 chars |
| `requestedCredits` | `Int?` | — | null if non-integer/non-positive sent |
| `status` | `String` | `"OPEN"` | `"OPEN" \| "CLOSED"` |
| `createdAt` | `DateTime` | `now()` | |
| `closedAt` | `DateTime?` | — | set when status → CLOSED, cleared on reopen |

Indexes: `@@index([status])` (filtered listing in `/admin/leads`),
`@@index([userId])` (dedupe lookup + user relation).

> `onDelete: Restrict` on `ContactRequest.user` guards against a manual delete
> that would orphan the lead ledger against `Project.user`'s `Cascade`.

## Project

The top-level engineering deliverable. Owns buildings, templates, the load
library, and the per-project breaker-family defaults.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `name` | `String` | — | |
| `client` `consultant` `contractor` `location` `engineer` `date` | `String` | — | submittal metadata |
| `voltage` | `Float` | `400` | V, line-to-line |
| `frequency` | `Float` | `50` | Hz |
| `powerFactor` | `Float` | `0.85` | |
| `maxDemandFactor` | `Float` | `0.8` | |
| `transformerSize` | `Float?` | — | kVA, sized upstream |
| `notes` | `String?` | — | |
| `preferredManufacturer` | `String` | `"MIXED"` | `"ABB" \| "SCHNEIDER" \| "MIXED"` |
| `defaultAcbFamilyId` | `String?` | — | FK → `BreakerFamily` (`SetNull`) |
| `defaultMccbFamilyId` | `String?` | — | FK → `BreakerFamily` (`SetNull`) |
| `defaultMcbFamilyId` | `String?` | — | FK → `BreakerFamily` (`SetNull`) |
| `country` | `String` | `"Syria"` | key into `src/lib/country-defaults.ts` |
| `logoUrl` | `String?` | — | uploaded company logo, used on the report cover |
| `calculationStandard` | `String` | `"IEC"` | `"IEC" \| "NEMA"` — selects the current-unbalance limit + label |
| `maxVoltageDropLighting` | `Float` | `3` | %, IEC 60364-5-52 for lighting |
| `maxVoltageDropPower` | `Float` | `5` | %, IEC 60364-5-52 for power |
| `userId` | `String` | — | FK → `User.id` (`onDelete: Cascade`) |
| `createdAt` | `DateTime` | `now()` | |
| `updatedAt` | `DateTime` | `@updatedAt` | |

Relations: `buildings`, `apartmentTemplates`, `loadLibraryItems`. Three named
back-relations on `BreakerFamily` for the default ACB/MCCB/MCB picks
(`"DefaultAcbFamily"` etc.).

## Building

A physical structure within a project.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `name` | `String` | — | |
| `floors` `serviceFloors` `apartmentsPerFloor` | `Int` | — | geometry |
| `mechanicalLoads` | `String?` | — | JSON string: `[{name, power, pf, qty, isEssential}]` |
| `generator` | `Float?` | — | sized generator kVA |
| `transformer` | `Float?` | — | sized transformer kVA |
| `supplyVoltage` | `String` | `"400V 3-Phase"` | |
| `earthingSystem` | `String` | `"TN-S"` | |
| `lightningProtection` | `Boolean` | `false` | |
| `projectId` | `String` | — | FK → `Project.id` (`Cascade`) |

Relations: `floorDesigns`, `buildingLoads`.

## BuildingLoad

A single-phase or three-phase load attached to a building (not a floor item).
Used for building-wide equipment.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id`, `buildingId`, `building` | | | FK → `Building.id` (`Cascade`) |
| `loadLibraryItemId` | `String?` | — | FK → `LoadLibraryItem.id` (`SetNull`) |
| `quantity` | `Int` | `1` | |
| `cableSize` `cableLength` `installMethod` `cableInsulation` | | | per-circuit sizing |
| `assignedPhase` | `Int?` | — | `1\|2\|3` for single-phase; `null` = auto-assign on read |

> `assignedPhase` is only meaningful for single-phase loads. Three-phase loads
> draw from all three and ignore it. When `null`, the phase-balance engine pins
> the load to the least-loaded phase on read (stable greedy order).

## ApartmentTemplate & ApartmentRoom

A reusable room-by-room apartment spec. `phases` is `1` or `3`.

`ApartmentTemplate`: `id`, `name`, `phases` (default `1`), `projectId`
(`Cascade`), `rooms`, `floorItems`, timestamps.

`ApartmentRoom`: `id`, `type` (`KITCHEN|BEDROOM|LIVING_ROOM|DINING_ROOM|
BATHROOM|HALL|OTHER`), `name`, `area` (m²), `hasAc`, `acBtu`, `loadDensity`
(VA/m², from country defaults), `connectedLoad` (computed: `area × loadDensity
+ AC watts`), `templateId` (`Cascade`).

> Three-phase apartment templates are flagged `internalImbalanceNotModelled` by
> the balance engine — they are bundles of 1-phase room circuits, not balanced
> motors.

## LoadLibraryItem

A reusable named load (Lighting / Socket / AC / Pump / Elevator / …).

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `name`, `category` | `String` | — | category is free-form string |
| `power` | `Float` | — | kW |
| `voltage` | `Float` | `230` | V |
| `phase` | `Int` | `1` | `1` or `3` |
| `powerFactor` | `Float` | `0.85` | |
| `demandFactor` | `Float` | `1.0` | |
| `quantity` | `Int` | `1` | |
| `runningCurrent` | `Float` | `0` | calculated/stored |
| `startingCurrent` | `Float?` | — | |
| `notes` | `String?` | — | |
| `projectId` | `String` | — | FK → `Project.id` (`Cascade`) |

## FloorDesign & FloorItem

`FloorDesign` represents one floor of a building. `FloorItem` is a board on
that floor.

`FloorDesign`: `id`, `floorNumber`, `hasFloorSubPanels` (default `false`),
`riserCableLength` `riserCableSize` `riserInstallMethod` (default `"C"`)
`riserCableInsulation` (default `"XLPE"`) — riser-cable fields only apply when
`hasFloorSubPanels=true`, `buildingId` (`Cascade`), `items`.

`FloorItem`:

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `type` | `String` | — | `APARTMENT \| SERVICE_PANEL \| PUMP_PANEL \| ELEVATOR_PANEL` |
| `name` | `String` | — | display name |
| `apartmentTemplateId` | `String?` | — | FK → `ApartmentTemplate.id` (`SetNull`) |
| `loadLibraryItemId` | `String?` | — | FK → `LoadLibraryItem.id` (`SetNull`) |
| `floorDesignId` | `String` | — | FK → `FloorDesign.id` (`Cascade`) |
| `calculatedConnectedLoad` | `Float` | `0` | recomputed on recalculate |
| `calculatedMaxDemand` | `Float` | `0` | |
| `calculatedCurrent` | `Float` | `0` | |
| `breakerSize` `cableSize` `voltageDrop` | | | per-circuit sizing results |
| `cableLength` | `Float?` | — | meters, configurable per circuit |
| `installMethod` | `String?` | `"C"` | IEC 60364-5-52: `B1\|B2\|C\|E\|F\|G` |
| `cableInsulation` | `String?` | `"XLPE"` | `"PVC" \| "XLPE"` |
| `assignedPhase` | `Int?` | — | `1\|2\|3` for single-phase; `null` = auto on read |

## EquipmentCatalog

A row in the real-breaker catalog (ABB / Schneider). Unique on the combination key.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `category` | `String` | — | `ACB\|MCCB\|MCB\|RCCB\|RCBO\|SPD\|CONTACTOR\|OVERLOAD\|METER\|CT` |
| `manufacturer` | `String` | — | `ABB` \| `SCHNEIDER` |
| `series` | `String` | — | e.g. `"Emax 2"`, `"Tmax XT4"`, `"Acti9 iC60"` |
| `model` | `String` | — | e.g. `"E2.2B 1600"` |
| `ratedCurrent` | `Float` | — | In, amps |
| `poles` | `Int` | `3` | |
| `breakingCapacity` | `Float` | — | Icu, kA |
| `tripUnit` | `String?` | — | e.g. `"Ekip Dip LSI"` |
| `settingsJson` | `String?` | — | JSON: adjustable protection settings ranges |
| `datasheetUrl` | `String?` | — | |
| `familyId` | `String?` | — | FK → `BreakerFamily.id` (`SetNull`) |

Unique: `@@unique([manufacturer, category, series, model, ratedCurrent, poles], name: "catalogUniqueKey")`. Index: `@@index([familyId])`.

## BreakerFamily

A grouping of catalog rows (e.g. "ComPacT NSX", "Acti9 iC60") a project picks
as its default ACB/MCCB/MCB family.

| Field | Type | Default | Notes |
|-------|------|---------|-------|
| `id` | `String` | `uuid()` | PK |
| `manufacturer` | `String` | — | |
| `category` | `String` | — | `ACB \| MCCB \| MCB` |
| `name` | `String` | — | |
| `catalogItems` | `EquipmentCatalog[]` | — | back-relation |
| `defaultAcb` `defaultMccb` `defaultMcb` | `Project[]` | — | named relations |
| `createdAt` `updatedAt` | | | |

Unique: `@@unique([manufacturer, category, name])`.

## BreakerSettings

Per-feeder protection settings (Ir/Tr/Isd/Tsd/I²t/Ii/Ig/Tg), standalone.

| Field | Type | Notes |
|-------|------|-------|
| `id` | `String` | PK |
| `breakerId` | `String` | `@unique` — the design tag, e.g. `"proj1-mdb-main"` |
| `model` `manufacturer` `frameSize` | `String` | |
| `ir` `tr` | `Float` | L pickup + delay (required) |
| `isd` `tsd` | `Float?` | S pickup + delay |
| `i2t` | `Boolean?` | S I²t state (on/off) |
| `ii` | `Float?` | I pickup (instantaneous) |
| `ig` `tg` | `Float?` | G pickup + delay |

## Migrations

`prisma/migrations/` — workflow is `npx prisma migrate dev --name <name>`
(NOT `db-push`). The ContactRequest migration is
`20260802105606_add_contact_request`. `prisma.config.ts` loads `dotenv/config`
so `tsx`-style bare runs that need the DB must go through the Prisma config.

## Related

- [API reference](./reference-api.md) — the route handlers that read/write these
  tables.
- [Captured-lead credit gate](./explanation-billing-captured-lead.md) — why
  `ContactRequest` is shaped the way it is.
