/**
 * Engine version, stamped onto every project by the recalculate routes.
 *
 * Bump whenever calculation SEMANTICS change (formulas, constants, sizing
 * conventions) so saved designs can be flagged as computed under older rules
 * until a recalculate heals them. Refactors that don't change numbers must
 * NOT bump this.
 */
export const ENGINE_VERSION = "2.0.0";
