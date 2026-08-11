import { SourceLocation } from './tokens';

export type NodeType =
  | 'NumberLiteral'
  | 'Identifier'
  | 'UnaryExpression'
  | 'BinaryExpression'
  | 'FunctionCall';

export interface BaseNode {
  type: NodeType;
  loc?: SourceLocation;
}

export interface NumberLiteralNode extends BaseNode {
  type: 'NumberLiteral';
  value: number;
  raw: string;
}

export interface IdentifierNode extends BaseNode {
  type: 'Identifier';
  name: string;
}

export type UnaryOperator = '+' | '-' | '~' | '!';

export interface UnaryExpressionNode extends BaseNode {
  type: 'UnaryExpression';
  operator: UnaryOperator;
  argument: ASTNode;
  prefix: boolean;
}

export type BinaryOperator =
  | '+'
  | '-'
  | '*'
  | '/'
  | '%'
  | '^'
  | '**'
  | '&'
  | '|'
  | 'xor'
  | '^^'
  | '<<'
  | '>>'
  | '>>>';

export interface BinaryExpressionNode extends BaseNode {
  type: 'BinaryExpression';
  operator: BinaryOperator;
  left: ASTNode;
  right: ASTNode;
}

export interface FunctionCallNode extends BaseNode {
  type: 'FunctionCall';
  name: string;
  args: ASTNode[];
}

export type ASTNode =
  | NumberLiteralNode
  | IdentifierNode
  | UnaryExpressionNode
  | BinaryExpressionNode
  | FunctionCallNode;

export interface ASTVisitor<R, C = void> {
  visitNumberLiteral(node: NumberLiteralNode, context: C): R;
  visitIdentifier(node: IdentifierNode, context: C): R;
  visitUnaryExpression(node: UnaryExpressionNode, context: C): R;
  visitBinaryExpression(node: BinaryExpressionNode, context: C): R;
  visitFunctionCall(node: FunctionCallNode, context: C): R;
}

/**
 * Dispatch helper that calls the appropriate visitor method for any AST node.
 */
export function acceptNode<R, C>(node: ASTNode, visitor: ASTVisitor<R, C>, context: C): R {
  switch (node.type) {
    case 'NumberLiteral':
      return visitor.visitNumberLiteral(node, context);
    case 'Identifier':
      return visitor.visitIdentifier(node, context);
    case 'UnaryExpression':
      return visitor.visitUnaryExpression(node, context);
    case 'BinaryExpression':
      return visitor.visitBinaryExpression(node, context);
    case 'FunctionCall':
      return visitor.visitFunctionCall(node, context);
    default: {
      const exhaustiveCheck: never = node;
      throw new Error(`Unhandled AST node type: ${(exhaustiveCheck as BaseNode).type}`);
    }
  }
}
