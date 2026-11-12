import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';

import { unwrapExpression } from './value';

// Reads a `type: 'function'` value, which is source text: what it is, never
// what it does. Nothing here runs it.

// `a`, `this.a`, `a.b.c`: a chain of plain property reads. Optional (`a?.b`)
// and computed (`a[b]`) reads don't count.
const isReference = (node: t.Node): boolean => {
  if (t.isIdentifier(node)) {
    return node.name !== 'undefined';
  }

  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.property) &&
    (t.isThisExpression(node.object) || isReference(node.object))
  );
};

// An arrow function or a `function` expression, node form.
export const isFunctionExpressionNode = (node: t.Node): boolean => {
  const value = unwrapExpression(node);

  return t.isArrowFunctionExpression(value) || t.isFunctionExpression(value);
};

const parse = (source: string): t.Expression | null => {
  if (!source.trim()) {
    return null;
  }

  try {
    return parseExpression(source, { plugins: ['jsx', 'typescript'] });
  } catch {
    return null;
  }
};

// An arrow function or a `function` expression. The panel treats a binding
// without a `type` as a function binding when its attribute holds one.
export const isFunctionExpressionSource = (source: string): boolean => {
  const expression = parse(source);

  return expression !== null && isFunctionExpressionNode(expression);
};

// What a function binding accepts: a function expression or a reference to
// a function. A call is refused, since `onClick={alert('x')}` runs on every
// render.
export const isFunctionSource = (source: string): boolean => {
  const expression = parse(source);

  if (expression === null) {
    return false;
  }

  return (
    isFunctionExpressionNode(expression) ||
    isReference(unwrapExpression(expression))
  );
};
