import {
  generateDocumentCode,
  parseDocument,
} from '@jbpark/live-editor/utils/ast';
import type { DocumentTree } from '@jbpark/live-editor/utils/ast';

const document: DocumentTree | undefined = parseDocument(
  'export default () => <main id="app-container" />;',
);

if (document) {
  generateDocumentCode(document);
}
