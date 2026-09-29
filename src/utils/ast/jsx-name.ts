import * as t from '@babel/types';

// A JSX element's tag name as it's written in the source: `section`,
// `Button`, or a member path such as `ui.Space` or `A.B.C`. A namespaced
// name (`svg:rect`) resolves to `''`.
//
// The one resolver for every pipeline step. Section discovery used to keep
// its own copy that only read plain identifiers, so it disagreed with
// extraction on every member-expression tag (#444). Kept in its own module
// rather than `helpers.ts` so `document.ts` can use it without pulling in
// `@babel/generator`, which the `utils` entry doesn't otherwise load.
export const getJSXTagName = (opening: t.JSXOpeningElement): string => {
  if (t.isJSXIdentifier(opening.name)) {
    return opening.name.name;
  }

  if (t.isJSXMemberExpression(opening.name)) {
    return resolveMemberName(opening.name);
  }

  return '';
};

const resolveMemberName = (expr: t.JSXMemberExpression): string => {
  const parts: string[] = [];

  const collectMemberParts = (
    node: t.JSXMemberExpression['object'] | t.JSXMemberExpression['property'],
  ): void => {
    if (t.isJSXIdentifier(node)) {
      parts.push(node.name);
    } else if (t.isJSXMemberExpression(node)) {
      collectMemberParts(node.object);

      if (t.isJSXIdentifier(node.property)) {
        parts.push(node.property.name);
      }
    }
  };

  collectMemberParts(expr.object);

  if (t.isJSXIdentifier(expr.property)) {
    parts.push(expr.property.name);
  }

  return parts.join('.');
};
