import {
  ProjectDrawingSpecSchema,
  type ProjectDrawingSpec,
} from "./project-spec-schema";
import {
  getCountryDefaults,
  calculateRoomLoad,
  calculateAcWatts,
  getDensityKeyForRoomType,
} from "@/lib/country-defaults";
import { getBuildingDiversityFactor, sizeTransformer } from "@/lib/calculations/loads";
import { nextBreakerRating, codeOf } from "@/lib/calculations/codes";

export interface AssumedField {
  field: string;
  assumedValue: string | number;
  reason: string;
}

export interface ValidationResult {
  valid: boolean;
  readyToCreate: boolean;
  requiresConfirmation: boolean;
  errors?: string[];
  missingOrAssumedFields: AssumedField[];
  confirmationPrompt?: string;
  estimatedTotals: {
    totalApartments: number;
    totalConnectedKw: number;
    estimatedMaxDemandKw: number;
    estimatedMaxDemandKva: number;
    suggestedTransformerKva: number;
    suggestedMainBreakerAmps: number;
  };
  resolvedParameters: {
    voltage: number;
    frequency: number;
    powerFactor: number;
    calculationStandard: "IEC" | "NEMA";
  };
}

export function validateProjectSpec(rawSpec: unknown): ValidationResult {
  const parseResult = ProjectDrawingSpecSchema.safeParse(rawSpec);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.issues.map(
      (err) => `${err.path.join(".")}: ${err.message}`
    );
    return {
      valid: false,
      readyToCreate: false,
      requiresConfirmation: false,
      errors: errorMessages,
      missingOrAssumedFields: [],
      estimatedTotals: {
        totalApartments: 0,
        totalConnectedKw: 0,
        estimatedMaxDemandKw: 0,
        estimatedMaxDemandKva: 0,
        suggestedTransformerKva: 0,
        suggestedMainBreakerAmps: 0,
      },
      resolvedParameters: {
        voltage: 400,
        frequency: 50,
        powerFactor: 0.85,
        calculationStandard: "IEC",
      },
    };
  }

  const spec = parseResult.data;
  const missingOrAssumedFields: AssumedField[] = [];

  const country = spec.country || "United Arab Emirates";
  const countryConfig = getCountryDefaults(country);

  // 1. Voltage & Frequency
  const voltage = spec.voltage || countryConfig.voltage;
  if (!spec.voltage) {
    missingOrAssumedFields.push({
      field: "voltage",
      assumedValue: `${voltage}V`,
      reason: `Default 3-phase supply voltage for ${country}`,
    });
  }

  const frequency = spec.frequency || countryConfig.frequency;
  if (!spec.frequency) {
    missingOrAssumedFields.push({
      field: "frequency",
      assumedValue: `${frequency}Hz`,
      reason: `Standard grid frequency for ${country}`,
    });
  }

  const powerFactor = spec.powerFactor || countryConfig.powerFactor;
  const calculationStandard =
    spec.calculationStandard || (country === "United States" ? "NEMA" : "IEC");

  // 2. Validate template mapping and compute loads
  const templateMap = new Map<string, { connectedKw: number; phases: number }>();
  const validationErrors: string[] = [];

  for (const tpl of spec.apartmentTemplates) {
    let tplWatts = 0;
    for (const room of tpl.rooms) {
      const densityKey = getDensityKeyForRoomType(room.type);
      const defaultDensity = countryConfig.roomDensities[densityKey] || 50;

      let roomWatts = 0;
      if (room.explicitLoadKw != null && room.explicitLoadKw > 0) {
        roomWatts = room.explicitLoadKw * 1000;
      } else if (room.explicitLoadKva != null && room.explicitLoadKva > 0) {
        roomWatts = room.explicitLoadKva * 1000 * powerFactor;
      } else {
        const density = room.loadDensityVaPerM2 ?? defaultDensity;
        if (room.loadDensityVaPerM2 == null) {
          missingOrAssumedFields.push({
            field: `template[${tpl.name}].room[${room.name}].loadDensityVaPerM2`,
            assumedValue: `${density} VA/m²`,
            reason: `Standard regional load density for room type ${room.type}`,
          });
        }
        roomWatts = calculateRoomLoad(
          room.areaM2,
          density,
          room.hasAc ?? true,
          countryConfig.acSizingRules
        );
      }
      tplWatts += roomWatts;
    }
    templateMap.set(tpl.name, {
      connectedKw: tplWatts / 1000,
      phases: tpl.phases ?? 1,
    });
  }

  // 3. Validate floor assignments
  let totalApartments = 0;
  let totalApartmentConnectedKw = 0;

  for (const bldg of spec.buildings) {
    for (const fa of bldg.floorAssignments) {
      if (!templateMap.has(fa.templateName)) {
        validationErrors.push(
          `Building "${bldg.name}" Floor ${fa.floorNumber} references unknown template "${fa.templateName}"`
        );
        continue;
      }
      const tpl = templateMap.get(fa.templateName)!;
      totalApartments += fa.count;
      totalApartmentConnectedKw += tpl.connectedKw * fa.count;
    }
  }

  // 4. Common Building Loads
  let totalBuildingLoadsKw = 0;
  for (const bldg of spec.buildings) {
    for (const bload of bldg.buildingLoads || []) {
      totalBuildingLoadsKw += bload.powerKw * (bload.quantity || 1);
    }
  }

  if (validationErrors.length > 0) {
    return {
      valid: false,
      readyToCreate: false,
      requiresConfirmation: false,
      errors: validationErrors,
      missingOrAssumedFields,
      estimatedTotals: {
        totalApartments,
        totalConnectedKw: totalApartmentConnectedKw + totalBuildingLoadsKw,
        estimatedMaxDemandKw: 0,
        estimatedMaxDemandKva: 0,
        suggestedTransformerKva: 0,
        suggestedMainBreakerAmps: 0,
      },
      resolvedParameters: {
        voltage,
        frequency,
        powerFactor,
        calculationStandard,
      },
    };
  }

  // 5. Coincidence / Diversity Factor and Demand
  const diversityFactor = getBuildingDiversityFactor(totalApartments);
  const estimatedAptDemandKw = totalApartmentConnectedKw * diversityFactor;
  const estimatedMaxDemandKw = parseFloat(
    (estimatedAptDemandKw + totalBuildingLoadsKw).toFixed(2)
  );
  const estimatedMaxDemandKva = parseFloat((estimatedMaxDemandKw / powerFactor).toFixed(2));

  // 6. Sizing suggestions
  const suggestedTransformerKva = sizeTransformer(estimatedMaxDemandKva, 1.2);
  const designCurrentAmps =
    (estimatedMaxDemandKw * 1000) / (Math.sqrt(3) * voltage * powerFactor);
  const suggestedMainBreakerAmps = nextBreakerRating(
    designCurrentAmps,
    codeOf(calculationStandard)
  );

  const readyToCreate = spec.isConfirmedByUser === true;
  const requiresConfirmation = !readyToCreate && missingOrAssumedFields.length > 0;

  let confirmationPrompt: string | undefined;
  if (requiresConfirmation) {
    confirmationPrompt =
      `Project "${spec.name}" — drawing schedule has been parsed. The following regional parameters were assumed:\n` +
      `- Country Standard: ${country} (${calculationStandard}, ${voltage}V 3-phase, ${frequency}Hz)\n` +
      `- Total Apartments: ${totalApartments} across ${spec.buildings.length} building(s)\n` +
      `- Connected Load: ${(totalApartmentConnectedKw + totalBuildingLoadsKw).toFixed(1)} kW (Max Demand: ${estimatedMaxDemandKw} kW / ${estimatedMaxDemandKva} kVA)\n` +
      `- Suggested Main Breaker: ${suggestedMainBreakerAmps}A | Suggested Transformer: ${suggestedTransformerKva} kVA\n\n` +
      `Assumed default parameters:\n` +
      missingOrAssumedFields
        .slice(0, 10)
        .map((f) => `• ${f.field}: ${f.assumedValue} (${f.reason})`)
        .join("\n") +
      (missingOrAssumedFields.length > 10
        ? `\n• ... and ${missingOrAssumedFields.length - 10} more room densities`
        : "") +
      `\n\nPlease confirm with the engineer to proceed with creation (set isConfirmedByUser: true).`;
  }

  return {
    valid: true,
    readyToCreate,
    requiresConfirmation,
    missingOrAssumedFields,
    confirmationPrompt,
    estimatedTotals: {
      totalApartments,
      totalConnectedKw: parseFloat((totalApartmentConnectedKw + totalBuildingLoadsKw).toFixed(2)),
      estimatedMaxDemandKw,
      estimatedMaxDemandKva,
      suggestedTransformerKva,
      suggestedMainBreakerAmps,
    },
    resolvedParameters: {
      voltage,
      frequency,
      powerFactor,
      calculationStandard,
    },
  };
}
