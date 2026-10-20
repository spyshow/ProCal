import { z } from "zod";

export const RoomTypeEnum = z.enum([
  "LIVING_ROOM",
  "BEDROOM",
  "KITCHEN",
  "BATHROOM",
  "DINING_ROOM",
  "HALL",
  "OTHER",
]);

const normalizeRoomType = (raw?: string): z.infer<typeof RoomTypeEnum> => {
  if (!raw) return "OTHER";
  const s = raw.trim().toUpperCase().replace(/[\s-_]+/g, "_");
  if (s === "LIVINGROOM" || s === "LIVING_ROOM" || s === "RECEPTION") return "LIVING_ROOM";
  if (s === "BEDROOM") return "BEDROOM";
  if (s === "KITCHEN") return "KITCHEN";
  if (s === "BATHROOM") return "BATHROOM";
  if (s === "DININGROOM" || s === "DINING_ROOM") return "DINING_ROOM";
  if (s === "HALL") return "HALL";
  return "OTHER";
};

export const RoomSpecInputSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.string().optional().default("OTHER"),
  areaM2: z.number().positive().max(10000).optional(),
  length: z.number().positive().optional(),
  width: z.number().positive().optional(),
  hasAc: z.boolean().optional(),
  includeAC: z.boolean().optional(),
  acBtu: z.number().positive().optional().nullable(),
  loadDensityVaPerM2: z.number().nonnegative().optional().nullable(),
  explicitLoadKw: z.number().nonnegative().optional().nullable(),
  explicitLoadKva: z.number().nonnegative().optional().nullable(),
});

export const RoomSpecSchema = RoomSpecInputSchema.transform((val) => {
  const calculatedArea =
    val.areaM2 ??
    (val.length && val.width ? parseFloat((val.length * val.width).toFixed(2)) : 0);
  return {
    name: val.name,
    type: normalizeRoomType(val.type),
    areaM2: calculatedArea,
    hasAc: val.hasAc ?? val.includeAC ?? true,
    acBtu: val.acBtu ?? null,
    loadDensityVaPerM2: val.loadDensityVaPerM2 ?? null,
    explicitLoadKw: val.explicitLoadKw ?? null,
    explicitLoadKva: val.explicitLoadKva ?? null,
  };
}).refine((r) => r.areaM2 > 0, {
  message: "Room areaM2 must be positive, or positive length and width must be specified",
});

export const ApartmentTemplateSpecInputSchema = z.object({
  name: z.string().min(1).max(100),
  phases: z.union([z.literal(1), z.literal(3)]).optional().default(1),
  rooms: z.array(RoomSpecSchema).min(1),
  countPerFloor: z.number().int().positive().optional(),
});

export const ApartmentTemplateSpecSchema = ApartmentTemplateSpecInputSchema.transform((val) => ({
  name: val.name,
  phases: val.phases ?? 1,
  rooms: val.rooms,
  countPerFloor: val.countPerFloor ?? 1,
}));

export const FloorAssignmentSpecInputSchema = z.object({
  floorNumber: z.number().int().min(0).max(200),
  templateName: z.string().min(1),
  count: z.number().int().positive().max(50),
  hasFloorSubPanels: z.boolean().optional().default(false),
  riserCableLengthM: z.number().positive().optional().nullable(),
  riserCableSize: z.string().optional().nullable(),
  riserBreakerSize: z.string().optional().nullable(),
});

export const FloorAssignmentSpecSchema = FloorAssignmentSpecInputSchema;

export const BuildingLoadCategoryEnum = z.enum([
  "HVAC",
  "ELEVATOR",
  "PUMP",
  "LIGHTING",
  "PLUMBING",
  "MECHANICAL",
  "OTHER",
]);

const normalizeLoadCategory = (raw?: string, name?: string): z.infer<typeof BuildingLoadCategoryEnum> => {
  if (raw) {
    const upper = raw.trim().toUpperCase();
    if (upper === "HVAC" || upper === "AC" || upper === "CHILLER") return "HVAC";
    if (upper === "ELEVATOR" || upper === "LIFT") return "ELEVATOR";
    if (upper === "PUMP") return "PUMP";
    if (upper === "LIGHTING" || upper === "LIGHTS") return "LIGHTING";
    if (upper === "PLUMBING") return "PLUMBING";
    if (upper === "MECHANICAL") return "MECHANICAL";
    if (upper === "OTHER") return "OTHER";
  }
  if (name && /lift|elevator/i.test(name)) return "ELEVATOR";
  if (name && /pump/i.test(name)) return "PUMP";
  if (name && /hvac|chiller|ac\b|air\s*condition/i.test(name)) return "HVAC";
  if (name && /light/i.test(name)) return "LIGHTING";
  return "OTHER";
};

export const CommonBuildingLoadInputSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.string().optional().default("OTHER"),
  powerKw: z.number().positive().max(2000).optional(),
  ratingKw: z.number().positive().max(2000).optional(),
  voltage: z.number().positive().optional().nullable(),
  phases: z.union([z.literal(1), z.literal(3)]).optional().default(3),
  powerFactor: z.number().min(0.1).max(1.0).optional().default(0.85),
  quantity: z.number().int().positive().max(20).optional().default(1),
  cableLengthM: z.number().positive().optional().default(30),
  cableSize: z.string().optional().nullable(),
  breakerSize: z.string().optional().nullable(),
});

export const CommonBuildingLoadSpecSchema = CommonBuildingLoadInputSchema.transform((val) => {
  const kw = val.powerKw ?? val.ratingKw ?? 1;
  return {
    name: val.name,
    category: normalizeLoadCategory(val.category, val.name),
    powerKw: kw,
    voltage: val.voltage ?? null,
    phases: val.phases ?? 3,
    powerFactor: val.powerFactor ?? 0.85,
    quantity: val.quantity ?? 1,
    cableLengthM: val.cableLengthM ?? 30,
    cableSize: val.cableSize ?? null,
    breakerSize: val.breakerSize ?? null,
  };
});

export const TypicalFloorApartmentInputSchema = z.object({
  templateName: z.string().min(1),
  count: z.number().int().positive().max(50).optional().default(1),
});

export const BuildingSpecInputSchema = z.object({
  name: z.string().min(1).max(100),
  floors: z.number().int().min(0).max(200).optional(),
  floorsCount: z.number().int().min(0).max(200).optional(),
  floorAssignments: z.array(FloorAssignmentSpecSchema).optional().default([]),
  typicalFloorApartments: z.array(TypicalFloorApartmentInputSchema).optional(),
  buildingLoads: z.array(CommonBuildingLoadSpecSchema).optional().default([]),
});

export const BuildingSpecSchema = BuildingSpecInputSchema.transform((val) => {
  const floors = val.floors ?? val.floorsCount ?? 1;
  let assignments = [...(val.floorAssignments ?? [])];

  if (assignments.length === 0 && val.typicalFloorApartments && val.typicalFloorApartments.length > 0) {
    assignments = [];
    for (let f = 1; f <= floors; f++) {
      for (const tpl of val.typicalFloorApartments) {
        assignments.push({
          floorNumber: f,
          templateName: tpl.templateName,
          count: tpl.count ?? 1,
          hasFloorSubPanels: false,
          riserCableLengthM: null,
          riserCableSize: null,
          riserBreakerSize: null,
        });
      }
    }
  }

  return {
    name: val.name,
    floors,
    floorAssignments: assignments,
    buildingLoads: val.buildingLoads ?? [],
  };
});

export const ProjectDrawingSpecInputSchema = z.object({
  name: z.string().min(1).max(120),
  country: z.string().optional().default("United Arab Emirates"),
  voltage: z.number().positive().optional().nullable(),
  frequency: z.number().positive().optional().nullable(),
  powerFactor: z.number().min(0.1).max(1.0).optional().default(0.85),
  calculationStandard: z.enum(["IEC", "NEMA"]).optional(),
  standard: z.enum(["IEC", "NEMA"]).optional(),
  preferredManufacturer: z.string().optional().default("MIXED"),
  apartmentTemplates: z.array(ApartmentTemplateSpecSchema).min(1),
  buildings: z.array(BuildingSpecSchema).optional().default([]),
  buildingCount: z.number().int().positive().optional(),
  floorsPerBuilding: z.number().int().positive().optional(),
  commonLoads: z.array(CommonBuildingLoadSpecSchema).optional(),
  buildingLoads: z.array(CommonBuildingLoadSpecSchema).optional(),
  isConfirmedByUser: z.boolean().optional().default(false),
  idempotencyKey: z.string().optional().nullable(),
});

export const ProjectDrawingSpecSchema = ProjectDrawingSpecInputSchema.transform((val) => {
  const calcStandard = val.calculationStandard ?? val.standard ?? "IEC";
  let buildings = [...(val.buildings ?? [])];

  if (buildings.length === 0 && val.buildingCount && val.buildingCount > 0) {
    const bCount = val.buildingCount;
    const fCount = val.floorsPerBuilding ?? 1;
    const commonLoads = val.commonLoads ?? val.buildingLoads ?? [];

    buildings = Array.from({ length: bCount }, (_, bIdx) => {
      const bName = `Building ${bIdx + 1}`;
      const floorAssignments: z.infer<typeof FloorAssignmentSpecSchema>[] = [];
      for (let f = 1; f <= fCount; f++) {
        for (const tpl of val.apartmentTemplates) {
          const count = tpl.countPerFloor ?? 1;
          floorAssignments.push({
            floorNumber: f,
            templateName: tpl.name,
            count,
            hasFloorSubPanels: false,
            riserCableLengthM: null,
            riserCableSize: null,
            riserBreakerSize: null,
          });
        }
      }
      return {
        name: bName,
        floors: fCount,
        floorAssignments,
        buildingLoads: commonLoads,
      };
    });
  }

  return {
    name: val.name,
    country: val.country ?? "United Arab Emirates",
    voltage: val.voltage ?? null,
    frequency: val.frequency ?? null,
    powerFactor: val.powerFactor ?? 0.85,
    calculationStandard: calcStandard,
    preferredManufacturer: val.preferredManufacturer ?? "MIXED",
    apartmentTemplates: val.apartmentTemplates,
    buildings,
    isConfirmedByUser: val.isConfirmedByUser ?? false,
    idempotencyKey: val.idempotencyKey ?? null,
  };
}).refine((val) => val.buildings.length > 0, {
  message: "Project must contain at least one building (or specify buildingCount > 0)",
});

export const UpdateProjectLoadsSpecSchema = z.object({
  projectId: z.string().min(1),
  buildingId: z.string().optional().nullable(),
  buildingLoads: z.array(CommonBuildingLoadSpecSchema).optional(),
  resetSizing: z.boolean().optional().default(false),
});

export const UpdateProjectSpecSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1).max(120).optional(),
  country: z.string().optional(),
  voltage: z.number().positive().optional().nullable(),
  frequency: z.number().positive().optional().nullable(),
  powerFactor: z.number().min(0.1).max(1.0).optional(),
  calculationStandard: z.enum(["IEC", "NEMA"]).optional(),
  preferredManufacturer: z.string().optional(),
  apartmentTemplates: z.array(ApartmentTemplateSpecSchema).optional(),
  buildings: z.array(BuildingSpecSchema).optional(),
  buildingLoads: z.array(CommonBuildingLoadSpecSchema).optional(),
  resetSizing: z.boolean().optional().default(true),
});

export const CircuitCableLengthSpecSchema = z.object({
  type: z.enum(["incomer", "riser", "floorItem", "buildingLoad"]),
  id: z.string().optional().nullable(),
  buildingName: z.string().optional().nullable(),
  floorNumber: z.number().int().optional().nullable(),
  circuitName: z.string().optional().nullable(),
  length: z.number().positive().max(10000),
  cableMaterial: z.enum(["copper", "aluminum"]).optional().nullable(),
  cableInsulation: z.enum(["XLPE", "PVC"]).optional().nullable(),
  installationMethod: z.string().optional().nullable(),
  ambientTemp: z.number().optional().nullable(),
  groupingCount: z.number().int().positive().optional().nullable(),
});

export const CableDefaultsSpecSchema = z.object({
  cableMaterial: z.enum(["copper", "aluminum"]).optional().default("copper"),
  cableInsulation: z.enum(["XLPE", "PVC"]).optional().default("XLPE"),
  installationMethod: z.string().optional().default("C"),
  ambientTemp: z.number().optional().default(30),
  groupingCount: z.number().int().positive().optional().default(1),
});

export const UpdateProjectCablesSpecSchema = z.object({
  projectId: z.string().min(1),
  defaults: CableDefaultsSpecSchema.optional().nullable(),
  circuitLengths: z.array(CircuitCableLengthSpecSchema).optional().default([]),
});

export type RoomSpec = z.infer<typeof RoomSpecSchema>;
export type ApartmentTemplateSpec = z.infer<typeof ApartmentTemplateSpecSchema>;
export type FloorAssignmentSpec = z.infer<typeof FloorAssignmentSpecSchema>;
export type CommonBuildingLoadSpec = z.infer<typeof CommonBuildingLoadSpecSchema>;
export type BuildingSpec = z.infer<typeof BuildingSpecSchema>;
export type ProjectDrawingSpec = z.infer<typeof ProjectDrawingSpecSchema>;
export type UpdateProjectLoadsSpec = z.infer<typeof UpdateProjectLoadsSpecSchema>;
export type UpdateProjectSpec = z.infer<typeof UpdateProjectSpecSchema>;
export type CircuitCableLengthSpec = z.infer<typeof CircuitCableLengthSpecSchema>;
export type CableDefaultsSpec = z.infer<typeof CableDefaultsSpecSchema>;
export type UpdateProjectCablesSpec = z.infer<typeof UpdateProjectCablesSpecSchema>;

export type RoomSpecInput = z.input<typeof RoomSpecSchema>;
export type ApartmentTemplateSpecInput = z.input<typeof ApartmentTemplateSpecSchema>;
export type FloorAssignmentSpecInput = z.input<typeof FloorAssignmentSpecSchema>;
export type CommonBuildingLoadSpecInput = z.input<typeof CommonBuildingLoadSpecSchema>;
export type BuildingSpecInput = z.input<typeof BuildingSpecSchema>;
export type ProjectDrawingSpecInput = z.input<typeof ProjectDrawingSpecSchema>;
export type UpdateProjectLoadsSpecInput = z.input<typeof UpdateProjectLoadsSpecSchema>;
export type UpdateProjectSpecInput = z.input<typeof UpdateProjectSpecSchema>;
export type CircuitCableLengthSpecInput = z.input<typeof CircuitCableLengthSpecSchema>;
export type CableDefaultsSpecInput = z.input<typeof CableDefaultsSpecSchema>;
export type UpdateProjectCablesSpecInput = z.input<typeof UpdateProjectCablesSpecSchema>;

