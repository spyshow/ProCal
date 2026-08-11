import {
  acceptNode,
  ASTNode,
  ASTVisitor,
  BinaryExpressionNode,
  FunctionCallNode,
  IdentifierNode,
  NumberLiteralNode,
  UnaryExpressionNode,
} from './ast';
import { SourceLocation } from './tokens';

export interface ValidationError {
  message: string;
  location?: SourceLocation;
}

export interface ValidationWarning {
  message: string;
  location?: SourceLocation;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  referencedVariables: string[];
  referencedFunctions: string[];
}

export interface FunctionArity {
  minArgs: number;
  maxArgs: number;
}

export const BUILTIN_CONSTANTS: ReadonlySet<string> = new Set([
  'PI',
  'E',
  'LN2',
  'LN10',
  'LOG2E',
  'LOG10E',
  'SQRT2',
  'SQRT1_2',
  'TAU',
  'INFINITY',
  'Infinity',
  'NAN',
  'NaN',
]);

export const BUILTIN_FUNCTIONS: ReadonlyMap<string, FunctionArity> = new Map([
  // Trigonometry
  ['sin', { minArgs: 1, maxArgs: 1 }],
  ['cos', { minArgs: 1, maxArgs: 1 }],
  ['tan', { minArgs: 1, maxArgs: 1 }],
  ['asin', { minArgs: 1, maxArgs: 1 }],
  ['acos', { minArgs: 1, maxArgs: 1 }],
  ['atan', { minArgs: 1, maxArgs: 1 }],
  ['atan2', { minArgs: 2, maxArgs: 2 }],
  ['sinh', { minArgs: 1, maxArgs: 1 }],
  ['cosh', { minArgs: 1, maxArgs: 1 }],
  ['tanh', { minArgs: 1, maxArgs: 1 }],

  // Math & rounding
  ['sqrt', { minArgs: 1, maxArgs: 1 }],
  ['cbrt', { minArgs: 1, maxArgs: 1 }],
  ['abs', { minArgs: 1, maxArgs: 1 }],
  ['exp', { minArgs: 1, maxArgs: 1 }],
  ['log', { minArgs: 1, maxArgs: 1 }],
  ['ln', { minArgs: 1, maxArgs: 1 }],
  ['log10', { minArgs: 1, maxArgs: 1 }],
  ['log2', { minArgs: 1, maxArgs: 1 }],
  ['floor', { minArgs: 1, maxArgs: 1 }],
  ['ceil', { minArgs: 1, maxArgs: 1 }],
  ['round', { minArgs: 1, maxArgs: 1 }],
  ['trunc', { minArgs: 1, maxArgs: 1 }],
  ['sign', { minArgs: 1, maxArgs: 1 }],

  // Multiple / Variadic arguments
  ['min', { minArgs: 1, maxArgs: Infinity }],
  ['max', { minArgs: 1, maxArgs: Infinity }],
  ['pow', { minArgs: 2, maxArgs: 2 }],
  ['hypot', { minArgs: 1, maxArgs: Infinity }],
  ['clamp', { minArgs: 3, maxArgs: 3 }],

  // Angle conversions
  ['deg', { minArgs: 1, maxArgs: 1 }],
  ['rad', { minArgs: 1, maxArgs: 1 }],
  ['degToRad', { minArgs: 1, maxArgs: 1 }],
  ['radToDeg', { minArgs: 1, maxArgs: 1 }],
]);

export interface ValidationOptions {
  allowedVariables?: string[] | Set<string> | Record<string, unknown>;
  customFunctions?: Record<string, FunctionArity | ((...args: unknown[]) => unknown)>;
  allowDynamicVariables?: boolean;
}

export class ValidationContext {
  public errors: ValidationError[] = [];
  public warnings: ValidationWarning[] = [];
  public referencedVariables: Set<string> = new Set();
  public referencedFunctions: Set<string> = new Set();
  public allowedVariables?: Set<string>;
  public customFunctions: Map<string, FunctionArity> = new Map();
  public allowDynamicVariables: boolean;

  constructor(options?: ValidationOptions) {
    this.allowDynamicVariables = options?.allowDynamicVariables ?? (options?.allowedVariables === undefined);

    if (options?.allowedVariables) {
      if (options.allowedVariables instanceof Set) {
        this.allowedVariables = options.allowedVariables;
      } else if (Array.isArray(options.allowedVariables)) {
        this.allowedVariables = new Set(options.allowedVariables);
      } else {
        this.allowedVariables = new Set(Object.keys(options.allowedVariables));
      }
    }

    if (options?.customFunctions) {
      for (const [name, fn] of Object.entries(options.customFunctions)) {
        if (typeof fn === 'function') {
          this.customFunctions.set(name, { minArgs: fn.length, maxArgs: fn.length });
        } else {
          this.customFunctions.set(name, fn);
        }
      }
    }
  }

  public addError(message: string, location?: SourceLocation): void {
    this.errors.push({ message, location });
  }

  public addWarning(message: string, location?: SourceLocation): void {
    this.warnings.push({ message, location });
  }
}

/**
 * AST Validator implementing the Visitor pattern.
 */
export class ASTValidatorVisitor implements ASTVisitor<void, ValidationContext> {
  public visitNumberLiteral(node: NumberLiteralNode, context: ValidationContext): void {
    if (typeof node.value !== 'number' || Number.isNaN(node.value)) {
      context.addError(`Invalid number literal '${node.raw}'`, node.loc);
    }
  }

  public visitIdentifier(node: IdentifierNode, context: ValidationContext): void {
    const name = node.name;
    context.referencedVariables.add(name);

    // If it's a known constant, it's valid
    if (BUILTIN_CONSTANTS.has(name) || BUILTIN_CONSTANTS.has(name.toUpperCase())) {
      return;
    }

    // Check against allowed variables
    if (!context.allowDynamicVariables) {
      if (!context.allowedVariables || !context.allowedVariables.has(name)) {
        context.addError(`Unknown variable or identifier '${name}'`, node.loc);
      }
    }
  }

  public visitUnaryExpression(node: UnaryExpressionNode, context: ValidationContext): void {
    const validUnaryOps = new Set(['+', '-', '~', '!']);
    if (!validUnaryOps.has(node.operator)) {
      context.addError(`Unsupported unary operator '${node.operator}'`, node.loc);
    }

    if (!node.argument) {
      context.addError(`Missing operand for unary operator '${node.operator}'`, node.loc);
      return;
    }

    acceptNode(node.argument, this, context);
  }

  public visitBinaryExpression(node: BinaryExpressionNode, context: ValidationContext): void {
    const validBinaryOps = new Set([
      '+',
      '-',
      '*',
      '/',
      '%',
      '^',
      '**',
      '&',
      '|',
      'xor',
      '^^',
      '<<',
      '>>',
      '>>>',
    ]);

    if (!validBinaryOps.has(node.operator)) {
      context.addError(`Unsupported binary operator '${node.operator}'`, node.loc);
    }

    if (!node.left || !node.right) {
      context.addError(`Missing operand for binary operator '${node.operator}'`, node.loc);
      return;
    }

    acceptNode(node.left, this, context);
    acceptNode(node.right, this, context);

    // Static division by literal zero check
    if (
      (node.operator === '/' || node.operator === '%') &&
      node.right.type === 'NumberLiteral' &&
      node.right.value === 0
    ) {
      context.addWarning('Division by literal zero detected', node.loc);
    }
  }

  public visitFunctionCall(node: FunctionCallNode, context: ValidationContext): void {
    const name = node.name;
    context.referencedFunctions.add(name);

    // Find function definition
    let arity = context.customFunctions.get(name);
    if (!arity) {
      arity = BUILTIN_FUNCTIONS.get(name) || BUILTIN_FUNCTIONS.get(name.toLowerCase());
    }

    if (!arity) {
      context.addError(`Unknown function '${name}'`, node.loc);
    } else {
      const argCount = node.args.length;
      if (argCount < arity.minArgs) {
        context.addError(
          `Function '${name}' expects at least ${arity.minArgs} argument(s), but received ${argCount}`,
          node.loc
        );
      } else if (argCount > arity.maxArgs) {
        context.addError(
          `Function '${name}' expects at most ${arity.maxArgs} argument(s), but received ${argCount}`,
          node.loc
        );
      }
    }

    for (const arg of node.args) {
      acceptNode(arg, this, context);
    }
  }
}

/**
 * Validate an AST node using the ASTValidatorVisitor.
 */
export function validateAST(ast: ASTNode, options?: ValidationOptions): ValidationResult {
  const context = new ValidationContext(options);
  const validator = new ASTValidatorVisitor();
  acceptNode(ast, validator, context);

  return {
    valid: context.errors.length === 0,
    errors: context.errors,
    warnings: context.warnings,
    referencedVariables: Array.from(context.referencedVariables),
    referencedFunctions: Array.from(context.referencedFunctions),
  };
}
