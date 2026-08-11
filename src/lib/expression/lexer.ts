import { Position, Token, TokenKind } from './tokens';

export class LexerError extends Error {
  public position: Position;

  constructor(message: string, position: Position) {
    super(`Lexer error at line ${position.line}, column ${position.column}: ${message}`);
    this.name = 'LexerError';
    this.position = position;
  }
}

export class Lexer {
  private input: string;
  private length: number;
  private index: number = 0;
  private line: number = 1;
  private column: number = 1;

  constructor(input: string) {
    this.input = input;
    this.length = input.length;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];

    while (this.index < this.length) {
      this.skipWhitespace();
      if (this.index >= this.length) break;

      const char = this.peek();
      const startPos = this.currentPos();

      // Numbers or decimal starting with .
      if (this.isDigit(char) || (char === '.' && this.isDigit(this.peek(1)))) {
        tokens.push(this.readNumber());
        continue;
      }

      // Identifiers / words / keywords (e.g. xor)
      if (this.isAlpha(char) || char === '_') {
        tokens.push(this.readIdentifier());
        continue;
      }

      // Multi-character and single-character operators
      const token = this.readOperatorOrDelimiter();
      if (token) {
        tokens.push(token);
        continue;
      }

      throw new LexerError(`Unexpected character '${char}'`, startPos);
    }

    tokens.push({
      kind: TokenKind.EOF,
      value: '',
      loc: { start: this.currentPos(), end: this.currentPos() },
    });

    return tokens;
  }

  private skipWhitespace(): void {
    while (this.index < this.length) {
      const char = this.peek();
      if (char === ' ' || char === '\t' || char === '\r') {
        this.advance();
      } else if (char === '\n') {
        this.index++;
        this.line++;
        this.column = 1;
      } else {
        break;
      }
    }
  }

  private readNumber(): Token {
    const startPos = this.currentPos();
    let raw = '';

    // Check for Binary (0b...), Hex (0x...), Octal (0o...)
    if (this.peek() === '0' && this.index + 1 < this.length) {
      const nextChar = this.peek(1).toLowerCase();

      if (nextChar === 'x') {
        // Hexadecimal
        raw += this.advance(); // '0'
        raw += this.advance(); // 'x'
        const hexStart = this.index;
        while (this.index < this.length && this.isHexDigit(this.peek())) {
          raw += this.advance();
        }
        if (this.index === hexStart) {
          throw new LexerError('Expected hexadecimal digits after 0x', startPos);
        }
        const numValue = parseInt(raw.slice(2), 16);
        return {
          kind: TokenKind.Number,
          value: raw,
          numValue,
          loc: { start: startPos, end: this.currentPos() },
        };
      }

      if (nextChar === 'b') {
        // Binary
        raw += this.advance(); // '0'
        raw += this.advance(); // 'b'
        const binStart = this.index;
        while (this.index < this.length && (this.peek() === '0' || this.peek() === '1')) {
          raw += this.advance();
        }
        if (this.index === binStart) {
          throw new LexerError('Expected binary digits after 0b', startPos);
        }
        const numValue = parseInt(raw.slice(2), 2);
        return {
          kind: TokenKind.Number,
          value: raw,
          numValue,
          loc: { start: startPos, end: this.currentPos() },
        };
      }

      if (nextChar === 'o') {
        // Octal
        raw += this.advance(); // '0'
        raw += this.advance(); // 'o'
        const octStart = this.index;
        while (this.index < this.length && this.isOctalDigit(this.peek())) {
          raw += this.advance();
        }
        if (this.index === octStart) {
          throw new LexerError('Expected octal digits after 0o', startPos);
        }
        const numValue = parseInt(raw.slice(2), 8);
        return {
          kind: TokenKind.Number,
          value: raw,
          numValue,
          loc: { start: startPos, end: this.currentPos() },
        };
      }
    }

    // Standard Decimal / Float / Scientific notation
    let hasDot = false;
    while (this.index < this.length) {
      const char = this.peek();
      if (this.isDigit(char)) {
        raw += this.advance();
      } else if (char === '.' && !hasDot && this.isDigit(this.peek(1))) {
        hasDot = true;
        raw += this.advance();
      } else {
        break;
      }
    }

    // Scientific notation (e.g. 1e5, 1.2e-3, 3E+2)
    if (this.index < this.length && (this.peek() === 'e' || this.peek() === 'E')) {
      let expStr = this.advance(); // 'e' or 'E'
      if (this.index < this.length && (this.peek() === '+' || this.peek() === '-')) {
        expStr += this.advance();
      }
      const expDigitsStart = this.index;
      while (this.index < this.length && this.isDigit(this.peek())) {
        expStr += this.advance();
      }
      if (this.index === expDigitsStart) {
        throw new LexerError('Expected exponent digits in scientific notation', startPos);
      }
      raw += expStr;
    }

    const numValue = Number(raw);
    if (Number.isNaN(numValue)) {
      throw new LexerError(`Invalid number format '${raw}'`, startPos);
    }

    return {
      kind: TokenKind.Number,
      value: raw,
      numValue,
      loc: { start: startPos, end: this.currentPos() },
    };
  }

  private readIdentifier(): Token {
    const startPos = this.currentPos();
    let name = '';

    while (this.index < this.length) {
      const char = this.peek();
      if (this.isAlpha(char) || this.isDigit(char) || char === '_') {
        name += this.advance();
      } else {
        break;
      }
    }

    // Check for keyword operators
    if (name.toLowerCase() === 'xor') {
      return {
        kind: TokenKind.BitwiseXor,
        value: name,
        loc: { start: startPos, end: this.currentPos() },
      };
    }

    return {
      kind: TokenKind.Identifier,
      value: name,
      loc: { start: startPos, end: this.currentPos() },
    };
  }

  private readOperatorOrDelimiter(): Token | null {
    const startPos = this.currentPos();

    // 3-character operators
    if (this.match('>>>')) {
      return {
        kind: TokenKind.UnsignedRightShift,
        value: '>>>',
        loc: { start: startPos, end: this.currentPos() },
      };
    }

    // 2-character operators
    if (this.match('<<')) {
      return {
        kind: TokenKind.LeftShift,
        value: '<<',
        loc: { start: startPos, end: this.currentPos() },
      };
    }
    if (this.match('>>')) {
      return {
        kind: TokenKind.RightShift,
        value: '>>',
        loc: { start: startPos, end: this.currentPos() },
      };
    }
    if (this.match('**')) {
      return {
        kind: TokenKind.DoubleMultiply,
        value: '**',
        loc: { start: startPos, end: this.currentPos() },
      };
    }
    if (this.match('^^')) {
      return {
        kind: TokenKind.BitwiseXor,
        value: '^^',
        loc: { start: startPos, end: this.currentPos() },
      };
    }

    // Single-character tokens
    const char = this.peek();
    switch (char) {
      case '+':
        this.advance();
        return { kind: TokenKind.Plus, value: '+', loc: { start: startPos, end: this.currentPos() } };
      case '-':
        this.advance();
        return { kind: TokenKind.Minus, value: '-', loc: { start: startPos, end: this.currentPos() } };
      case '*':
        this.advance();
        return { kind: TokenKind.Multiply, value: '*', loc: { start: startPos, end: this.currentPos() } };
      case '/':
        this.advance();
        return { kind: TokenKind.Divide, value: '/', loc: { start: startPos, end: this.currentPos() } };
      case '%':
        this.advance();
        return { kind: TokenKind.Modulo, value: '%', loc: { start: startPos, end: this.currentPos() } };
      case '^':
        this.advance();
        return { kind: TokenKind.Power, value: '^', loc: { start: startPos, end: this.currentPos() } };
      case '&':
        this.advance();
        return { kind: TokenKind.BitwiseAnd, value: '&', loc: { start: startPos, end: this.currentPos() } };
      case '|':
        this.advance();
        return { kind: TokenKind.BitwiseOr, value: '|', loc: { start: startPos, end: this.currentPos() } };
      case '~':
        this.advance();
        return { kind: TokenKind.BitwiseNot, value: '~', loc: { start: startPos, end: this.currentPos() } };
      case '!':
        this.advance();
        return { kind: TokenKind.LogicalNot, value: '!', loc: { start: startPos, end: this.currentPos() } };
      case '(':
        this.advance();
        return { kind: TokenKind.LParen, value: '(', loc: { start: startPos, end: this.currentPos() } };
      case ')':
        this.advance();
        return { kind: TokenKind.RParen, value: ')', loc: { start: startPos, end: this.currentPos() } };
      case ',':
        this.advance();
        return { kind: TokenKind.Comma, value: ',', loc: { start: startPos, end: this.currentPos() } };
      default:
        return null;
    }
  }

  private match(expected: string): boolean {
    if (this.input.startsWith(expected, this.index)) {
      for (let i = 0; i < expected.length; i++) {
        this.advance();
      }
      return true;
    }
    return false;
  }

  private peek(offset: number = 0): string {
    const pos = this.index + offset;
    return pos < this.length ? this.input[pos] : '';
  }

  private advance(): string {
    const char = this.input[this.index++];
    this.column++;
    return char;
  }

  private currentPos(): Position {
    return {
      line: this.line,
      column: this.column,
      index: this.index,
    };
  }

  private isDigit(char: string): boolean {
    return char >= '0' && char <= '9';
  }

  private isOctalDigit(char: string): boolean {
    return char >= '0' && char <= '7';
  }

  private isHexDigit(char: string): boolean {
    return (
      (char >= '0' && char <= '9') ||
      (char >= 'a' && char <= 'f') ||
      (char >= 'A' && char <= 'F')
    );
  }

  private isAlpha(char: string): boolean {
    return (
      (char >= 'a' && char <= 'z') ||
      (char >= 'A' && char <= 'Z')
    );
  }
}

export function tokenize(input: string): Token[] {
  return new Lexer(input).tokenize();
}
