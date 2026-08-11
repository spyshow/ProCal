import { acceptNode, ASTNode } from './ast';
import { ASTEvaluatorVisitor, evaluateAST, EvaluationContext } from './evaluator';
import { LexerError } from './lexer';
import { parse, ParserError } from './parser';
import { validateAST, ValidationOptions, ValidationResult } from './validator';

export * from './ast';
export * from './tokens';
export * from './lexer';
export * from './parser';
export * from './validator';
export * from './evaluator';

/**
 * Parses and evaluates a mathematical expression string or AST securely.
 *
 * @param input Mathematical expression string or pre-parsed AST node.
 * @param context Optional evaluation context containing variables or custom functions.
 * @returns The evaluated numeric result.
 */
export function evaluate(
  input: string | ASTNode,
  context?: EvaluationContext | Record<string, number>
): number {
  const evalContext: EvaluationContext | undefined = context
    ? 'variables' in context || 'functions' in context
      ? (context as EvaluationContext)
      : { variables: context as Record<string, number> }
    : undefined;

  const ast = typeof input === 'string' ? parse(input) : input;
  return evaluateAST(ast, evalContext);
}

/**
 * Validates an expression string or AST node without evaluating it.
 *
 * @param input Mathematical expression string or pre-parsed AST node.
 * @param options Optional validation rules (allowed variables, custom functions).
 * @returns ValidationResult with status, errors, warnings, and referenced symbols.
 */
export function validate(
  input: string | ASTNode,
  options?: ValidationOptions
): ValidationResult {
  try {
    const ast = typeof input === 'string' ? parse(input) : input;
    return validateAST(ast, options);
  } catch (error) {
    if (error instanceof LexerError || error instanceof ParserError) {
      return {
        valid: false,
        errors: [
          {
            message: error.message,
            location: {
              start: error.position,
              end: error.position,
            },
          },
        ],
        warnings: [],
        referencedVariables: [],
        referencedFunctions: [],
      };
    }
    return {
      valid: false,
      errors: [{ message: (error as Error).message }],
      warnings: [],
      referencedVariables: [],
      referencedFunctions: [],
    };
  }
}

/**
 * Compiles a mathematical expression into an optimized, reusable evaluation function.
 * Tokenization and AST parsing happen once upfront.
 *
 * @param expression The mathematical expression string to compile.
 * @param options Optional validation options to check during compilation.
 * @returns A callable function accepting variables and returning the evaluated result.
 */
export function compile(
  expression: string,
  options?: ValidationOptions
): (variables?: Record<string, number>, customFunctions?: Record<string, (...args: number[]) => number>) => number {
  const ast = parse(expression);
  if (options) {
    const validation = validateAST(ast, options);
    if (!validation.valid) {
      const errorMsg = validation.errors.map((e) => e.message).join('; ');
      throw new Error(`Expression validation failed: ${errorMsg}`);
    }
  }

  const visitor = new ASTEvaluatorVisitor();
  return (variables?: Record<string, number>, customFunctions?: Record<string, (...args: number[]) => number>) => {
    return acceptNode(ast, visitor, { variables, functions: customFunctions });
  };
}
