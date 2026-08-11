export interface Position {
  line: number;
  column: number;
  index: number;
}

export interface SourceLocation {
  start: Position;
  end: Position;
}

export enum TokenKind {
  // Literals
  Number = 'Number',
  Identifier = 'Identifier',

  // Arithmetic operators
  Plus = '+',
  Minus = '-',
  Multiply = '*',
  Divide = '/',
  Modulo = '%',
  Power = '^',
  DoubleMultiply = '**',

  // Bitwise operators
  BitwiseAnd = '&',
  BitwiseOr = '|',
  BitwiseXor = 'xor',
  BitwiseNot = '~',
  LeftShift = '<<',
  RightShift = '>>',
  UnsignedRightShift = '>>>',

  // Logical / Unary operators
  LogicalNot = '!',

  // Delimiters & Grouping
  LParen = '(',
  RParen = ')',
  Comma = ',',

  // End of input
  EOF = 'EOF',
}

export interface Token {
  kind: TokenKind;
  value: string;
  numValue?: number;
  loc: SourceLocation;
}
