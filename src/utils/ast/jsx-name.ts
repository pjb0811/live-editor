import * as t from '@babel/types';

// A JSX element's tag name as written in the source: `section`, `Button`,
// or a member path such as `ui.Space` or `A.B.C`. A namespaced name
// (`svg:rect`) gives `''`. Every step of the pipeline uses this one (#444).
// It's in its own module so `document.ts` doesn't load `@babel/generator`.
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
