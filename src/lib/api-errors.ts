import { NextResponse } from "next/server";
import { CalculationError } from "@/lib/calculations/validate";
import { ZodError } from "zod";

/**
 * Maps known error families to proper HTTP responses instead of a generic 500:
 * - CalculationError → 400 (bad/unsizingable input data)
 * - ZodError         → 400 (schema validation failure)
 * - anything else    → 500 (logged server-side, details withheld)
 */
export function errorResponse(error: unknown, logLabel: string): NextResponse {
  if (error instanceof CalculationError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: error.issues },
      { status: 400 }
    );
  }
  console.error(`${logLabel}:`, error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}
