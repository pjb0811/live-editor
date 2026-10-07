// Compiles against the packed package with no `@babel/*` packages next to
// it, so the published declarations must not import them (#363).
import { checkDocument, extractSections } from '@jbpark/live-editor/utils';
import { extract, update, updateAll } from '@jbpark/live-editor/utils/ast';
import type { DataAttrNode, UpdateResult } from '@jbpark/live-editor/utils/ast';

const code = 'export default () => <main id="app-container" />;';

if (checkDocument(code).ok) {
  for (const section of extractSections(code)) {
    const nodes: DataAttrNode[] = extract(section.code);
    const result: UpdateResult = update(section.code, 'id', 'Title', 'x');

    updateAll(
      result.code,
      nodes.map(node => ({
        dataId: node.id ?? '',
        label: 'Title',
        value: 'y',
      })),
    );
  }
}
