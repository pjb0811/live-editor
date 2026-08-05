import { parse, parseExpression } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';

import type { Section } from '../../types';
import { generateCode } from './helpers';

const APP_CONTAINER_ID = 'app-container';
const SECTION_TAG = 'section';
const DATA_NAME_ATTR = 'data-name';

export interface DocumentTree {
  ast: t.File;
  container: t.JSXElement;
}

const getTagName = (element: t.JSXElement): string => {
  const name = element.openingElement.name;
  return t.isJSXIdentifier(name) ? name.name : '';
};

const getAttrValue = (
  element: t.JSXElement,
  attrName: string,
): string | undefined => {
  const attr = element.openingElement.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) &&
      t.isJSXIdentifier(a.name) &&
      a.name.name === attrName,
  );

  return attr && t.isStringLiteral(attr.value) ? attr.value.value : undefined;
};

const isSectionElement = (node: t.Node): node is t.JSXElement =>
  t.isJSXElement(node) && getTagName(node) === SECTION_TAG;

const isBlankJSXText = (node: t.Node): boolean =>
  t.isJSXText(node) && !node.value.trim();

const findContainer = (ast: t.File): t.JSXElement | undefined => {
  let container: t.JSXElement | undefined;

  traverse(ast, {
    JSXElement(path) {
      if (getAttrValue(path.node, 'id') === APP_CONTAINER_ID) {
        container = path.node;
        path.stop();
      }
    },
  });

  return container;
};

// Parses the whole source once into a single Babel AST — the shared "document
// tree" that section-level (this file) and field-level (extract.ts/update.ts)
// operations both read/write via @babel/* instead of the previous regex-based
// section slicing living in a separate, conflicting parser.
export const parseDocument = (code: string): DocumentTree | undefined => {
  try {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const container = findContainer(ast);

    return container ? { ast, container } : undefined;
  } catch (e) {
    console.warn('⚠️ Failed to parse document', e);
    return undefined;
  }
};

export const getSections = (doc: DocumentTree): Section[] =>
  doc.container.children.filter(isSectionElement).map((node, index) => ({
    id: `${index}`,
    name: getAttrValue(node, DATA_NAME_ATTR) || `${index + 1}번째 컴포넌트`,
    code: generateCode(node),
  }));

export const generateDocumentCode = (doc: DocumentTree): string =>
  generateCode(doc.ast);

const parseSectionNode = (code: string): t.JSXElement | undefined => {
  try {
    const expr = parseExpression(code, {
      plugins: ['jsx', 'typescript'],
    });

    return t.isJSXElement(expr) ? expr : undefined;
  } catch (e) {
    console.warn('⚠️ Failed to parse section', e);
    return undefined;
  }
};

export const replaceDocumentSections = (
  fullCode: string,
  sectionCodes: string[],
): string => {
  const doc = parseDocument(fullCode);

  if (!doc) {
    return fullCode;
  }

  const nextSections = sectionCodes
    .map(parseSectionNode)
    .filter((node): node is t.JSXElement => Boolean(node));

  const preserved = doc.container.children.filter(
    child => !isSectionElement(child) && !isBlankJSXText(child),
  );

  doc.container.children = [...nextSections, ...preserved];

  return generateDocumentCode(doc);
};

export const generateSectionPreview = (
  fullCode: string,
  sectionCode: string,
): string => {
  const doc = parseDocument(fullCode);
  const sectionNode = parseSectionNode(sectionCode);

  if (!doc || !sectionNode) {
    return fullCode;
  }

  doc.container.children = [sectionNode];

  return generateDocumentCode(doc);
};
