import { describe, expect, it } from 'vitest';
import {
  compile,
  evaluate,
  LexerError,
  parse,
  ParserError,
  tokenize,
  validate,
} from './index';

describe('Expression Engine', () => {
  describe('Lexer / Tokenizer', () => {
    it('tokenizes decimal integers and floating-point numbers', () => {
      const tokens = tokenize('42 3.14159 .5 0.001').filter((t) => t.kind !== 'EOF');
      expect(tokens.map((t) => t.numValue)).toEqual([42, 3.14159, 0.5, 0.001]);
    });

    it('tokenizes scientific notation', () => {
      const tokens = tokenize('1e5 2.5e-3 1.2E+4 1e-6').filter((t) => t.kind !== 'EOF');
      expect(tokens.map((t) => t.numValue)).toEqual([100000, 0.0025, 12000, 0.000001]);
    });

    it('tokenizes binary literals', () => {
      const tokens = tokenize('0b1010 0B1111 0b0').filter((t) => t.kind !== 'EOF');
      expect(tokens.map((t) => t.numValue)).toEqual([10, 15, 0]);
    });

    it('tokenizes hexadecimal literals', () => {
      const tokens = tokenize('0xFF 0x10 0x1a2b 0X2A').filter((t) => t.kind !== 'EOF');
      expect(tokens.map((t) => t.numValue)).toEqual([255, 16, 6699, 42]);
    });

    it('tokenizes octal literals', () => {
      const tokens = tokenize('0o77 0O10 0o755').filter((t) => t.kind !== 'EOF');
      expect(tokens.map((t) => t.numValue)).toEqual([63, 8, 493]);
    });

    it('tokenizes multi-character and single-character operators', () => {
      const tokens = tokenize('+ - * / % ^ ** & | ~ ! << >> >>> xor ^^ ( ) ,');
      const values = tokens.map((t) => t.value).filter((v) => v !== '');
      expect(values).toEqual([
        '+', '-', '*', '/', '%', '^', '**', '&', '|', '~', '!',
        '<<', '>>', '>>>', 'xor', '^^', '(', ')', ',',
      ]);
    });

    it('throws LexerError on unexpected characters with line/column information', () => {
      expect(() => tokenize('1 + @ 3')).toThrow(LexerError);
      try {
        tokenize('1 + @ 3');
      } catch (err: unknown) {
        expect((err as LexerError).position.column).toBe(5);
      }
    });

    it('throws LexerError on malformed literals', () => {
      expect(() => tokenize('0x')).toThrow(LexerError);
      expect(() => tokenize('0b')).toThrow(LexerError);
      expect(() => tokenize('0o')).toThrow(LexerError);
      expect(() => tokenize('1e')).toThrow(LexerError);
    });
  });

  describe('Basic Arithmetic & Associativity', () => {
    it('evaluates addition and subtraction (left-associative)', () => {
      expect(evaluate('1 + 2 + 3')).toBe(6);
      expect(evaluate('10 - 4 - 2')).toBe(4); // (10 - 4) - 2 = 4
      expect(evaluate('10 - (4 - 2)')).toBe(8);
      expect(evaluate('100 - 50 + 25')).toBe(75);
    });

    it('evaluates multiplication, division, and modulo (left-associative)', () => {
      expect(evaluate('2 * 3 * 4')).toBe(24);
      expect(evaluate('20 / 4 / 2')).toBe(2.5); // (20 / 4) / 2 = 2.5
      expect(evaluate('20 / (4 / 2)')).toBe(10);
      expect(evaluate('17 % 5')).toBe(2);
      expect(evaluate('25 % 7 % 3')).toBe(1); // (25 % 7) % 3 = 4 % 3 = 1
    });

    it('evaluates mixed arithmetic respecting standard precedence', () => {
      expect(evaluate('1 + 2 * 3')).toBe(7);
      expect(evaluate('2 * 3 + 4')).toBe(10);
      expect(evaluate('10 + 20 / 5 - 2 * 3')).toBe(8); // 10 + 4 - 6 = 8
      expect(evaluate('(1 + 2) * (3 + 4)')).toBe(21);
    });
  });

  describe('Exponentiation (^) & Right-Associativity', () => {
    it('evaluates exponentiation as right-associative', () => {
      // 2 ^ 3 ^ 2 = 2 ^ (3 ^ 2) = 2 ^ 9 = 512
      expect(evaluate('2 ^ 3 ^ 2')).toBe(512);
      // Explicit parenthesization to left: (2 ^ 3) ^ 2 = 8 ^ 2 = 64
      expect(evaluate('(2 ^ 3) ^ 2')).toBe(64);
    });

    it('supports ** as exponentiation operator with right-associativity', () => {
      expect(evaluate('2 ** 3')).toBe(8);
      expect(evaluate('2 ** 3 ** 2')).toBe(512);
      expect(evaluate('(2 ** 3) ** 2')).toBe(64);
    });

    it('handles chained powers correctly', () => {
      // 3 ^ 2 ^ 1 = 3 ^ (2 ^ 1) = 3 ^ 2 = 9
      expect(evaluate('3 ^ 2 ^ 1')).toBe(9);
      // 2 ^ 2 ^ 2 ^ 2 = 2 ^ (2 ^ (2 ^ 2)) = 2 ^ (2 ^ 4) = 2 ^ 16 = 65536
      expect(evaluate('2 ^ 2 ^ 2 ^ 2')).toBe(65536);
    });
  });

  describe('Unary Operators & Precedence vs Exponentiation', () => {
    it('evaluates unary minus before exponentiation as -(x^y)', () => {
      // Per specification: -3^2 must evaluate as -(3^2) = -9
      expect(evaluate('-3^2')).toBe(-9);
      expect(evaluate('-3**2')).toBe(-9);
      // Parenthesized: (-3)^2 = 9
      expect(evaluate('(-3)^2')).toBe(9);
      expect(evaluate('(-3)**2')).toBe(9);
    });

    it('binds unary minus tighter than infix addition and multiplication', () => {
      expect(evaluate('-3 * 2')).toBe(-6);
      expect(evaluate('2 * -3')).toBe(-6);
      expect(evaluate('5 + -3')).toBe(2);
      expect(evaluate('5 - -3')).toBe(8);
    });

    it('handles multiple consecutive unary operators', () => {
      expect(evaluate('--5')).toBe(5);
      expect(evaluate('---5')).toBe(-5);
      expect(evaluate('++5')).toBe(5);
      expect(evaluate('-+5')).toBe(-5);
      expect(evaluate('+-5')).toBe(-5);
    });

    it('evaluates unary bitwise NOT (~)', () => {
      expect(evaluate('~0')).toBe(-1);
      expect(evaluate('~5')).toBe(-6);
      expect(evaluate('~-1')).toBe(0);
      expect(evaluate('~3^2')).toBe(-10); // ~(3^2) = ~9 = -10
    });

    it('evaluates unary logical NOT (!)', () => {
      expect(evaluate('!0')).toBe(1);
      expect(evaluate('!5')).toBe(0);
      expect(evaluate('!1')).toBe(0);
      expect(evaluate('!!1')).toBe(1);
    });
  });

  describe('Bitwise Operations', () => {
    it('evaluates bitwise AND (&), OR (|), XOR (xor, ^^)', () => {
      expect(evaluate('5 & 3')).toBe(1); // 0101 & 0011 = 0001 (1)
      expect(evaluate('5 | 2')).toBe(7); // 0101 | 0010 = 0111 (7)
      expect(evaluate('5 xor 3')).toBe(6); // 0101 ^ 0011 = 0110 (6)
      expect(evaluate('5 ^^ 3')).toBe(6);
    });

    it('evaluates bitwise shift operators (<<, >>, >>>)', () => {
      expect(evaluate('1 << 4')).toBe(16);
      expect(evaluate('16 >> 2')).toBe(4);
      expect(evaluate('-16 >> 2')).toBe(-4);
      expect(evaluate('-16 >>> 2')).toBe(1073741820);
    });

    it('evaluates bitwise operations with lowest precedence', () => {
      // 1 + 2 << 2 = (1 + 2) << 2 = 3 << 2 = 12
      expect(evaluate('1 + 2 << 2')).toBe(12);
      // 10 & 3 + 1 = 10 & (3 + 1) = 10 & 4 = 0
      expect(evaluate('10 & 3 + 1')).toBe(0);
      // 10 | 2 * 3 = 10 | (2 * 3) = 10 | 6 = 14
      expect(evaluate('10 | 2 * 3')).toBe(14);
    });

    it('supports hexadecimal and binary literals in bitwise expressions', () => {
      expect(evaluate('0xFF & 0x0F')).toBe(15);
      expect(evaluate('0b1010 | 0b0101')).toBe(15);
      expect(evaluate('0b1 << 8')).toBe(256);
    });
  });

  describe('Built-in Constants & Math Functions', () => {
    it('evaluates built-in constants', () => {
      expect(evaluate('PI')).toBe(Math.PI);
      expect(evaluate('E')).toBe(Math.E);
      expect(evaluate('TAU')).toBe(Math.PI * 2);
      expect(evaluate('SQRT2')).toBe(Math.SQRT2);
    });

    it('evaluates trigonometric functions', () => {
      expect(evaluate('sin(0)')).toBe(0);
      expect(evaluate('cos(0)')).toBe(1);
      expect(evaluate('sin(PI / 2)')).toBeCloseTo(1, 10);
      expect(evaluate('cos(PI)')).toBeCloseTo(-1, 10);
      expect(evaluate('tan(0)')).toBe(0);
    });

    it('evaluates utility and rounding functions', () => {
      expect(evaluate('sqrt(16)')).toBe(4);
      expect(evaluate('cbrt(27)')).toBe(3);
      expect(evaluate('abs(-42)')).toBe(42);
      expect(evaluate('floor(3.99)')).toBe(3);
      expect(evaluate('ceil(3.01)')).toBe(4);
      expect(evaluate('round(3.5)')).toBe(4);
      expect(evaluate('trunc(-3.7)')).toBe(-3);
      expect(evaluate('sign(-42)')).toBe(-1);
    });

    it('evaluates variadic and multi-argument functions', () => {
      expect(evaluate('min(5, 2, 9, 1, 8)')).toBe(1);
      expect(evaluate('max(5, 2, 9, 1, 8)')).toBe(9);
      expect(evaluate('pow(2, 5)')).toBe(32);
      expect(evaluate('hypot(3, 4)')).toBe(5);
      expect(evaluate('clamp(15, 0, 10)')).toBe(10);
      expect(evaluate('clamp(-5, 0, 10)')).toBe(0);
      expect(evaluate('clamp(7, 0, 10)')).toBe(7);
    });

    it('evaluates angle conversions (deg, rad)', () => {
      expect(evaluate('deg(PI)')).toBe(180);
      expect(evaluate('rad(180)')).toBe(Math.PI);
    });
  });

  describe('Variables & Engineering Formulas', () => {
    it('evaluates expressions with custom variable context', () => {
      expect(evaluate('x * y + z', { x: 2, y: 3, z: 4 })).toBe(10);
      expect(evaluate('a^2 + b^2', { a: 3, b: 4 })).toBe(25);
    });

    it('evaluates electrical three-phase current formula: S / (sqrt(3) * V)', () => {
      // S = 50 kVA, V = 0.4 kV (400V) -> I = 50 / (sqrt(3) * 0.4) ≈ 72.16878 A
      const result = evaluate('S / (sqrt(3) * V)', { S: 50, V: 0.4 });
      expect(result).toBeCloseTo(72.16878, 4);
    });

    it('evaluates voltage drop formula: (sqrt(3) * I * L * (R * cos(phi) + X * sin(phi))) / (n * 1000)', () => {
      const formula = '(sqrt(3) * I * L * (R * cos(phi) + X * sin(phi))) / (n * 1000)';
      const context = {
        I: 100, // Current (A)
        L: 50,  // Length (m)
        R: 0.387, // Resistance (ohm/km)
        X: 0.08,  // Reactance (ohm/km)
        phi: Math.acos(0.85), // Power factor angle for PF = 0.85
        n: 1, // Number of runs
      };
      const vDrop = evaluate(formula, context);
      expect(vDrop).toBeGreaterThan(0);
      expect(vDrop).toBeCloseTo(3.214, 2);
    });
  });

  describe('AST Validation (Visitor Pattern)', () => {
    it('validates correct expressions with valid variables and functions', () => {
      const result = validate('sqrt(x^2 + y^2) + sin(PI / 2)', {
        allowedVariables: ['x', 'y'],
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.referencedVariables).toContain('x');
      expect(result.referencedVariables).toContain('y');
      expect(result.referencedFunctions).toContain('sqrt');
      expect(result.referencedFunctions).toContain('sin');
    });

    it('rejects unknown variables when allowedVariables is specified', () => {
      const result = validate('x + unknownVar', {
        allowedVariables: ['x'],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Unknown variable or identifier 'unknownVar'");
    });

    it('rejects unknown functions', () => {
      const result = validate('invalidFunction(10)');
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain("Unknown function 'invalidFunction'");
    });

    it('enforces function arity rules (too few / too many arguments)', () => {
      // sqrt expects 1 argument
      const tooFew = validate('sqrt()');
      expect(tooFew.valid).toBe(false);
      expect(tooFew.errors[0].message).toContain("Function 'sqrt' expects at least 1 argument");

      const tooMany = validate('sqrt(1, 2, 3)');
      expect(tooMany.valid).toBe(false);
      expect(tooMany.errors[0].message).toContain("Function 'sqrt' expects at most 1 argument");

      // pow expects 2 arguments
      const powFew = validate('pow(2)');
      expect(powFew.valid).toBe(false);
      expect(powFew.errors[0].message).toContain("Function 'pow' expects at least 2 argument");
    });

    it('warns on literal division by zero', () => {
      const result = validate('100 / 0');
      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].message).toContain('Division by literal zero');
    });
  });

  describe('Syntax Error Rejection (Parser & Lexer)', () => {
    it('rejects empty or whitespace-only expressions', () => {
      expect(() => parse('')).toThrow(ParserError);
      expect(() => parse('   ')).toThrow(ParserError);
    });

    it('rejects unclosed and mismatched parentheses', () => {
      expect(() => parse('(1 + 2')).toThrow(ParserError);
      expect(() => parse('((1 + 2) * 3')).toThrow(ParserError);
      expect(() => parse('1 + 2)')).toThrow(ParserError);
    });

    it('rejects empty parentheses ()', () => {
      expect(() => parse('1 + ()')).toThrow(ParserError);
      expect(() => parse('()')).toThrow(ParserError);
    });

    it('rejects missing operands and trailing operators', () => {
      expect(() => parse('1 +')).toThrow(ParserError);
      expect(() => parse('1 + 2 *')).toThrow(ParserError);
      expect(() => parse('* 4')).toThrow(ParserError);
      expect(() => parse('1 + * 2')).toThrow(ParserError);
    });

    it('rejects invalid trailing commas in function calls', () => {
      expect(() => parse('max(1, 2,)')).toThrow(ParserError);
    });
  });

  describe('Security & Sandboxing', () => {
    it('does not execute arbitrary JavaScript or prototype pollution', () => {
      // Malicious payloads must be safely parsed as identifiers and rejected by validation/evaluation
      const payload1 = 'constructor.prototype';
      const result1 = validate(payload1, { allowedVariables: [] });
      expect(result1.valid).toBe(false);

      expect(() => evaluate('process.exit(1)')).toThrow();
      expect(() => evaluate('console.log(123)')).toThrow();
      expect(() => evaluate('eval("1+1")')).toThrow();
    });
  });

  describe('Pre-compiled Expressions (compile)', () => {
    it('compiles and reuses AST for multiple variable inputs without re-parsing', () => {
      const calcHypot = compile('sqrt(a^2 + b^2)', { allowedVariables: ['a', 'b'] });

      expect(calcHypot({ a: 3, b: 4 })).toBe(5);
      expect(calcHypot({ a: 5, b: 12 })).toBe(13);
      expect(calcHypot({ a: 8, b: 15 })).toBe(17);
    });

    it('throws at compile time if validation fails', () => {
      expect(() => compile('sqrt(x, y)', { allowedVariables: ['x', 'y'] })).toThrow(/validation failed/i);
    });
  });
});
