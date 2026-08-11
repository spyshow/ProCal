import {
  ASTNode,
  BinaryExpressionNode,
  BinaryOperator,
  FunctionCallNode,
  IdentifierNode,
  NumberLiteralNode,
  UnaryExpressionNode,
  UnaryOperator,
} from './ast';
import { tokenize } from './lexer';
import { Position, SourceLocation, Token, TokenKind } from './tokens';

export class ParserError extends Error {
  public position: Position;

  constructor(message: string, position: Position) {
    super(`Parser error at line ${position.line}, column ${position.column}: ${message}`);
    this.name = 'ParserError';
    this.position = position;
  }
}

// Precedence levels for Pratt Parser
const PREC_LOWEST = 0;
const PREC_BITWISE_OR = 10;
const PREC_BITWISE_XOR = 15;
const PREC_BITWISE_AND = 20;
const PREC_BITWISE_SHIFT = 30;
const PREC_ADD_SUB = 40;
const PREC_MUL_DIV_MOD = 50;
const PREC_UNARY_PREFIX = 60; // Binds tighter than +, -, *, /, bitwise, but weaker than ^
const PREC_POWER = 70; // Exponentiation is highest binary operator

export class Parser {
  private tokens: Token[];
  private current: number = 0;

  constructor(tokensOrInput: Token[] | string) {
    if (typeof tokensOrInput === 'string') {
      this.tokens = tokenize(tokensOrInput);
    } else {
      this.tokens = tokensOrInput;
    }
  }

  public parse(): ASTNode {
    if (this.tokens.length === 0 || this.peek().kind === TokenKind.EOF) {
      const pos = this.peek()?.loc.start || { line: 1, column: 1, index: 0 };
      throw new ParserError('Unexpected empty expression', pos);
    }

    const ast = this.parseExpression(PREC_LOWEST);

    if (this.peek().kind !== TokenKind.EOF) {
      const token = this.peek();
      throw new ParserError(`Unexpected token '${token.value}' after complete expression`, token.loc.start);
    }

    return ast;
  }

  private parseExpression(minBindingPower: number): ASTNode {
    let left = this.parsePrefix();

    while (true) {
      const token = this.peek();
      if (token.kind === TokenKind.EOF) break;

      const bindingPower = this.getInfixBindingPower(token.kind);
      if (!bindingPower || bindingPower.left <= minBindingPower) {
        break;
      }

      left = this.parseInfix(left, bindingPower.right);
    }

    return left;
  }

  /**
   * Prefix (nud) parser: numbers, identifiers, function calls, unary operators, parentheses.
   */
  private parsePrefix(): ASTNode {
    const token = this.advance();

    switch (token.kind) {
      case TokenKind.Number: {
        const node: NumberLiteralNode = {
          type: 'NumberLiteral',
          value: token.numValue !== undefined ? token.numValue : Number(token.value),
          raw: token.value,
          loc: token.loc,
        };
        return node;
      }

      case TokenKind.Identifier: {
        // Check if this is a function call: identifier followed by '('
        if (this.peek().kind === TokenKind.LParen) {
          return this.parseFunctionCall(token);
        }

        const node: IdentifierNode = {
          type: 'Identifier',
          name: token.value,
          loc: token.loc,
        };
        return node;
      }

      // Unary operators: +, -, ~, !
      case TokenKind.Plus:
      case TokenKind.Minus:
      case TokenKind.BitwiseNot:
      case TokenKind.LogicalNot: {
        const op = token.value as UnaryOperator;
        // Prefix unary binds with PREC_UNARY_PREFIX (60)
        // This allows exponentiation (70/69) to bind tighter, e.g. -3^2 -> -(3^2)
        const argument = this.parseExpression(PREC_UNARY_PREFIX);
        const loc: SourceLocation = {
          start: token.loc.start,
          end: argument.loc ? argument.loc.end : token.loc.end,
        };
        const node: UnaryExpressionNode = {
          type: 'UnaryExpression',
          operator: op,
          argument,
          prefix: true,
          loc,
        };
        return node;
      }

      case TokenKind.LParen: {
        if (this.peek().kind === TokenKind.RParen) {
          throw new ParserError('Empty parentheses are not allowed', token.loc.start);
        }
        const expr = this.parseExpression(PREC_LOWEST);
        const closing = this.consume(
          TokenKind.RParen,
          "Expected closing parenthesis ')'"
        );
        const loc: SourceLocation = {
          start: token.loc.start,
          end: closing.loc.end,
        };
        // Preserve location on inner expression or wrap
        return {
          ...expr,
          loc,
        };
      }

      case TokenKind.EOF:
        throw new ParserError('Unexpected end of expression', token.loc.start);

      default:
        throw new ParserError(`Unexpected token '${token.value}'`, token.loc.start);
    }
  }

  /**
   * Infix (led) parser: binary operators.
   */
  private parseInfix(left: ASTNode, rightBindingPower: number): ASTNode {
    const opToken = this.advance();
    const right = this.parseExpression(rightBindingPower);

    let operatorStr = opToken.value;
    if (opToken.kind === TokenKind.DoubleMultiply) {
      operatorStr = '^'; // Normalize ** to ^
    } else if (opToken.kind === TokenKind.BitwiseXor) {
      operatorStr = 'xor';
    }

    const loc: SourceLocation = {
      start: left.loc ? left.loc.start : opToken.loc.start,
      end: right.loc ? right.loc.end : opToken.loc.end,
    };

    const node: BinaryExpressionNode = {
      type: 'BinaryExpression',
      operator: operatorStr as BinaryOperator,
      left,
      right,
      loc,
    };

    return node;
  }

  private parseFunctionCall(identifierToken: Token): FunctionCallNode {
    this.consume(TokenKind.LParen, "Expected '(' after function name");
    const args: ASTNode[] = [];

    if (this.peek().kind !== TokenKind.RParen) {
      while (true) {
        args.push(this.parseExpression(PREC_LOWEST));

        if (this.peek().kind === TokenKind.Comma) {
          this.advance(); // consume ','
          // Check for trailing comma or missing argument
          if (this.peek().kind === TokenKind.RParen) {
            throw new ParserError('Unexpected trailing comma in function arguments', this.peek().loc.start);
          }
        } else {
          break;
        }
      }
    }

    const rparen = this.consume(TokenKind.RParen, "Expected ')' at end of function call");

    const loc: SourceLocation = {
      start: identifierToken.loc.start,
      end: rparen.loc.end,
    };

    return {
      type: 'FunctionCall',
      name: identifierToken.value,
      args,
      loc,
    };
  }

  /**
   * Return left and right binding powers for infix operators.
   * Left-associative: rightBp = leftBp + 1
   * Right-associative (Power): rightBp = leftBp - 1
   */
  private getInfixBindingPower(kind: TokenKind): { left: number; right: number } | null {
    switch (kind) {
      case TokenKind.BitwiseOr:
        return { left: PREC_BITWISE_OR, right: PREC_BITWISE_OR + 1 }; // 10, 11 (left-assoc)
      case TokenKind.BitwiseXor:
        return { left: PREC_BITWISE_XOR, right: PREC_BITWISE_XOR + 1 }; // 15, 16 (left-assoc)
      case TokenKind.BitwiseAnd:
        return { left: PREC_BITWISE_AND, right: PREC_BITWISE_AND + 1 }; // 20, 21 (left-assoc)
      case TokenKind.LeftShift:
      case TokenKind.RightShift:
      case TokenKind.UnsignedRightShift:
        return { left: PREC_BITWISE_SHIFT, right: PREC_BITWISE_SHIFT + 1 }; // 30, 31 (left-assoc)
      case TokenKind.Plus:
      case TokenKind.Minus:
        return { left: PREC_ADD_SUB, right: PREC_ADD_SUB + 1 }; // 40, 41 (left-assoc)
      case TokenKind.Multiply:
      case TokenKind.Divide:
      case TokenKind.Modulo:
        return { left: PREC_MUL_DIV_MOD, right: PREC_MUL_DIV_MOD + 1 }; // 50, 51 (left-assoc)
      case TokenKind.Power:
      case TokenKind.DoubleMultiply:
        // Right-associative exponentiation: 2^3^2 = 2^(3^2)
        return { left: PREC_POWER, right: PREC_POWER - 1 }; // 70, 69 (right-assoc)
      default:
        return null;
    }
  }

  private peek(): Token {
    return this.tokens[this.current] || {
      kind: TokenKind.EOF,
      value: '',
      loc: {
        start: { line: 1, column: 1, index: 0 },
        end: { line: 1, column: 1, index: 0 },
      },
    };
  }

  private advance(): Token {
    const token = this.peek();
    if (this.current < this.tokens.length) {
      this.current++;
    }
    return token;
  }

  private consume(expectedKind: TokenKind, errorMessage: string): Token {
    const token = this.peek();
    if (token.kind !== expectedKind) {
      throw new ParserError(errorMessage, token.loc.start);
    }
    return this.advance();
  }
}

export function parse(input: string | Token[]): ASTNode {
  return new Parser(input).parse();
}
