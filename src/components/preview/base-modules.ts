import * as ui from '@jbpark/ui-kit';
import * as utils from '@jbpark/ui-kit/utils';

// The specifiers every compiled sample can import without the host supplying
// them (`import * as ui from 'ui-kit'`). Lives with the preview, its only
// consumer, rather than in `~/utils`: evaluating ui-kit's namespace reaches
// its stylesheet imports, so keeping it there made `@jbpark/live-editor/utils`
// (and every entry built on it) unimportable outside a bundler — Node, SSR,
// scripts. See #372.
export const baseModules = {
  'ui-kit': ui,
  'ui-kit/utils': utils,
};
