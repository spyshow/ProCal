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

export class EvaluationError extends Error {
  public location?: SourceLocation;

  constructor(message: string, location?: SourceLocation) {
    super(message);
    this.name = 'EvaluationError';
    this.location = location;
  }
}

export interface EvaluationContext {
  variables?: Record<string, number>;
  functions?: Record<string, (...args: number[]) => number>;
}

export const BUILTIN_MATH_CONSTANTS: Readonly<Record<string, number>> = {
  PI: Math.PI,
  E: Math.E,
  LN2: Math.LN2,
  LN10: Math.LN10,
  LOG2E: Math.LOG2E,
  LOG10E: Math.LOG10E,
  SQRT2: Math.SQRT2,
  SQRT1_2: Math.SQRT1_2,
  TAU: Math.PI * 2,
  INFINITY: Infinity,
  Infinity: Infinity,
  NAN: NaN,
  NaN: NaN,
};

export const BUILTIN_MATH_FUNCTIONS: Readonly<Record<string, (...args: number[]) => number>> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,

  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  exp: Math.exp,
  log: Math.log,
  ln: Math.log,
  log10: Math.log10,
  log2: Math.log2,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  trunc: Math.trunc,
  sign: Math.sign,

  min: Math.min,
  max: Math.max,
  pow: Math.pow,
  hypot: Math.hypot,
  clamp: (val: number, min: number, max: number) => Math.min(Math.max(val, min), max),

  deg: (rad: number) => rad * (180 / Math.PI),
  rad: (deg: number) => deg * (Math.PI / 180),
  degToRad: (deg: number) => deg * (Math.PI / 180),
  radToDeg: (rad: number) => rad * (180 / Math.PI),
};

/**
 * AST Evaluator implementing the Visitor pattern.
 */
export class ASTEvaluatorVisitor implements ASTVisitor<number, EvaluationContext | undefined> {
  public visitNumberLiteral(node: NumberLiteralNode): number {
    return node.value;
  }

  public visitIdentifier(node: IdentifierNode, context?: EvaluationContext): number {
    const name = node.name;

    // Check context variables
    if (context?.variables && Object.prototype.hasOwnProperty.call(context.variables, name)) {
      const val = context.variables[name];
      if (typeof val === 'number') {
        return val;
      }
    }

    // Check built-in constants (case-sensitive and upper-case fallback)
    if (Object.prototype.hasOwnProperty.call(BUILTIN_MATH_CONSTANTS, name)) {
      return BUILTIN_MATH_CONSTANTS[name];
    }
    const upperName = name.toUpperCase();
    if (Object.prototype.hasOwnProperty.call(BUILTIN_MATH_CONSTANTS, upperName)) {
      return BUILTIN_MATH_CONSTANTS[upperName];
    }

    throw new EvaluationError(`Undefined variable '${name}'`, node.loc);
  }

  public visitUnaryExpression(node: UnaryExpressionNode, context?: EvaluationContext): number {
    const argumentValue = acceptNode(node.argument, this, context);

    switch (node.operator) {
      case '+':
        return +argumentValue;
      case '-':
        return -argumentValue;
      case '~':
        return ~argumentValue;
      case '!':
        return argumentValue === 0 ? 1 : 0;
      default:
        throw new EvaluationError(`Unsupported unary operator '${node.operator}'`, node.loc);
    }
  }

  public visitBinaryExpression(node: BinaryExpressionNode, context?: EvaluationContext): number {
    const leftValue = acceptNode(node.left, this, context);
    const rightValue = acceptNode(node.right, this, context);

    switch (node.operator) {
      case '+':
        return leftValue + rightValue;
      case '-':
        return leftValue - rightValue;
      case '*':
        return leftValue * rightValue;
      case '/':
        return leftValue / rightValue;
      case '%':
        return leftValue % rightValue;
      case '^':
      case '**':
        return Math.pow(leftValue, rightValue);
      case '&':
        return leftValue & rightValue;
      case '|':
        return leftValue | rightValue;
      case 'xor':
      case '^^':
        return leftValue ^ rightValue;
      case '<<':
        return leftValue << rightValue;
      case '>>':
        return leftValue >> rightValue;
      case '>>>':
        return leftValue >>> rightValue;
      default:
        throw new EvaluationError(`Unsupported binary operator '${node.operator}'`, node.loc);
    }
  }

  public visitFunctionCall(node: FunctionCallNode, context?: EvaluationContext): number {
    const name = node.name;

    // Resolve function
    let fn = context?.functions ? context.functions[name] : undefined;
    if (!fn) {
      fn = BUILTIN_MATH_FUNCTIONS[name] || BUILTIN_MATH_FUNCTIONS[name.toLowerCase()];
    }

    if (!fn || typeof fn !== 'function') {
      throw new EvaluationError(`Undefined function '${name}'`, node.loc);
    }

    const evaluatedArgs = node.args.map((arg) => acceptNode(arg, this, context));
    return fn(...evaluatedArgs);
  }
}

/**
 * Evaluates an AST node safely without dynamic eval().
 */
export function evaluateAST(ast: ASTNode, context?: EvaluationContext): number {
  const visitor = new ASTEvaluatorVisitor();
  return acceptNode(ast, visitor, context);
}
