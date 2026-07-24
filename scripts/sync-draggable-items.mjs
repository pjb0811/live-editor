import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import * as t from '@babel/types';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const playgroundPath = path.resolve(
  __dirname,
  '../src/pages/Playground/index.tsx',
);
const enumsPath = path.resolve(__dirname, '../src/enums/index.ts');

const dedent = value => {
  const lines = value.replace(/^\n/, '').replace(/\s*$/, '').split('\n');

  if (!lines.length) {
    return '';
  }

  const [firstLine, ...restLines] = lines;
  const indent = restLines.reduce((min, line) => {
    if (!line.trim()) {
      return min;
    }

    const match = line.match(/^(\s*)/);
    return Math.min(min, match?.[1]?.length ?? 0);
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(indent)) {
    return value.trim();
  }

  return [firstLine.trimStart(), ...restLines.map(line => line.slice(indent))]
    .join('\n')
    .trim();
};

const indentBlock = (value, spaces) => {
  const prefix = ' '.repeat(spaces);
  return value
    .split('\n')
    .map(line => `${prefix}${line}`)
    .join('\n');
};

const slugify = value => {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
};

const toSingleQuoted = value => {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
};

const getJsxAttributeValue = (attributes, name) => {
  const target = attributes.find(
    attribute =>
      t.isJSXAttribute(attribute) &&
      t.isJSXIdentifier(attribute.name) &&
      attribute.name.name === name,
  );

  if (!target || !t.isJSXAttribute(target) || !target.value) {
    return null;
  }

  if (t.isStringLiteral(target.value)) {
    return target.value.value;
  }

  if (
    t.isJSXExpressionContainer(target.value) &&
    t.isStringLiteral(target.value.expression)
  ) {
    return target.value.expression.value;
  }

  return null;
};

const isMainContainer = node => {
  if (!t.isJSXElement(node)) {
    return false;
  }

  const { openingElement } = node;

  return (
    t.isJSXIdentifier(openingElement.name) &&
    openingElement.name.name === 'main' &&
    getJsxAttributeValue(openingElement.attributes, 'id') === 'app-container'
  );
};

const isSectionElement = node => {
  return (
    t.isJSXElement(node) &&
    t.isJSXIdentifier(node.openingElement.name) &&
    node.openingElement.name.name === 'section'
  );
};

const extractSections = source => {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });

  let mainElement = null;

  traverse.default(ast, {
    JSXElement(path) {
      if (mainElement || !isMainContainer(path.node)) {
        return;
      }

      mainElement = path.node;
      path.stop();
    },
  });

  if (!mainElement) {
    throw new Error('Could not find <main id="app-container"> in Playground.');
  }

  return mainElement.children.filter(isSectionElement).map(section => {
    const name = getJsxAttributeValue(
      section.openingElement.attributes,
      'data-name',
    );

    if (!name) {
      throw new Error('Found a <section> without data-name in Playground.');
    }

    if (section.start == null || section.end == null) {
      throw new Error(`Could not read source range for section "${name}".`);
    }

    const code = dedent(source.slice(section.start, section.end));

    return {
      id: slugify(name),
      name,
      code,
    };
  });
};

const serializeItems = items => {
  const body = items
    .map(item => {
      const code = indentBlock(item.code, 6);

      return [
        '  {',
        `    id: ${toSingleQuoted(item.id)},`,
        `    name: ${toSingleQuoted(item.name)},`,
        '    code: `',
        code,
        '    `,',
        '  },',
      ].join('\n');
    })
    .join('\n');

  return `export const DRAGGABLE_ITEMS: Section[] = [\n${body}\n];`;
};

const syncDraggableItems = async () => {
  const [playgroundSource, enumsSource] = await Promise.all([
    readFile(playgroundPath, 'utf8'),
    readFile(enumsPath, 'utf8'),
  ]);

  const items = extractSections(playgroundSource);
  const nextBlock = serializeItems(items);
  const nextSource = enumsSource.replace(
    /export const DRAGGABLE_ITEMS: Section\[] = \[[\s\S]*?\n\];\s*$/,
    `${nextBlock}\n`,
  );

  if (nextSource === enumsSource) {
    throw new Error(
      'Could not replace DRAGGABLE_ITEMS block in src/enums/index.ts.',
    );
  }

  await writeFile(enumsPath, nextSource, 'utf8');

  console.log(`Synced ${items.length} sections into DRAGGABLE_ITEMS.`);
};

syncDraggableItems().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
