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

export const RoomSpecSchema = z.object({
  name: z.string().min(1).max(100),
  type: RoomTypeEnum.optional().default("OTHER"),
  areaM2: z.number().positive().max(10000),
  hasAc: z.boolean().optional().default(true),
  acBtu: z.number().positive().optional().nullable(),
  loadDensityVaPerM2: z.number().nonnegative().optional().nullable(),
  explicitLoadKw: z.number().nonnegative().optional().nullable(),
  explicitLoadKva: z.number().nonnegative().optional().nullable(),
});

export const ApartmentTemplateSpecSchema = z.object({
  name: z.string().min(1).max(100),
  phases: z.union([z.literal(1), z.literal(3)]).optional().default(1),
  rooms: z.array(RoomSpecSchema).min(1),
});

export const FloorAssignmentSpecSchema = z.object({
  floorNumber: z.number().int().min(0).max(200),
  templateName: z.string().min(1),
  count: z.number().int().positive().max(50),
  hasFloorSubPanels: z.boolean().optional().default(false),
  riserCableLengthM: z.number().positive().optional().nullable(),
  riserCableSize: z.string().optional().nullable(),
  riserBreakerSize: z.string().optional().nullable(),
});

export const BuildingLoadCategoryEnum = z.enum([
  "HVAC",
  "ELEVATOR",
  "PUMP",
  "LIGHTING",
  "PLUMBING",
  "MECHANICAL",
  "OTHER",
]);

export const CommonBuildingLoadSpecSchema = z.object({
  name: z.string().min(1).max(100),
  category: BuildingLoadCategoryEnum.optional().default("OTHER"),
  powerKw: z.number().positive().max(2000),
  voltage: z.number().positive().optional().nullable(),
  phases: z.union([z.literal(1), z.literal(3)]).optional().default(3),
  powerFactor: z.number().min(0.1).max(1.0).optional().default(0.85),
  quantity: z.number().int().positive().max(20).optional().default(1),
  cableLengthM: z.number().positive().optional().default(30),
  cableSize: z.string().optional().nullable(),
  breakerSize: z.string().optional().nullable(),
});

export const BuildingSpecSchema = z.object({
  name: z.string().min(1).max(100),
  floors: z.number().int().min(0).max(200),
  floorAssignments: z.array(FloorAssignmentSpecSchema).default([]),
  buildingLoads: z.array(CommonBuildingLoadSpecSchema).optional().default([]),
});

export const ProjectDrawingSpecSchema = z.object({
  name: z.string().min(1).max(120),
  country: z.string().optional().default("United Arab Emirates"),
  voltage: z.number().positive().optional().nullable(),
  frequency: z.number().positive().optional().nullable(),
  powerFactor: z.number().min(0.1).max(1.0).optional().default(0.85),
  calculationStandard: z.enum(["IEC", "NEMA"]).optional().default("IEC"),
  preferredManufacturer: z.string().optional().default("MIXED"),
  apartmentTemplates: z.array(ApartmentTemplateSpecSchema).min(1),
  buildings: z.array(BuildingSpecSchema).min(1),
  isConfirmedByUser: z.boolean().optional().default(false),
  idempotencyKey: z.string().optional().nullable(),
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

