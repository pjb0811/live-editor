import type { DocumentOptions } from '~/utils/ast/document';
import { createDocument } from '~/utils/sections';

// The imports `uiKitPaletteSections` expect in the document.
const UI_KIT_IMPORTS = `
import * as ui from 'ui-kit';
import { cn } from 'ui-kit/utils';
`;

// `createDocument()` with `ui` and `cn` imported from the `ui-kit` modules,
// for a document built from `uiKitPaletteSections`.
export const createUiKitDocument = (options?: DocumentOptions): string =>
  UI_KIT_IMPORTS + createDocument(options);
