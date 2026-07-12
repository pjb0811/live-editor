import { parseExpression } from '@babel/parser';
import * as t from '@babel/types';
import { nanoid } from 'nanoid';

import { DATA_ATTR } from '../../enums';
import { generateCode } from './helpers';

export const replaceIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}="[^"]*"`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

export const fillIds = (
  code: string,
  generateId: () => string = () => nanoid(6),
): string => {
  return code.replace(new RegExp(`${DATA_ATTR.ID}=""`, 'g'), () => {
    return `${DATA_ATTR.ID}="${generateId()}"`;
  });
};

export const clone = (
  element: t.Node,
  generateId: () => string = () => nanoid(6),
) => {
  const cloned = t.cloneNode(element, true);
  const generatedCode = generateCode(cloned);
  const code = replaceIds(generatedCode, generateId);

  return parseExpression(code, {
    plugins: ['jsx', 'typescript'],
  });
};
