import * as ui from '@jbpark/ui-kit';
import * as utils from '@jbpark/ui-kit/utils';

// The modules preview code imports as `ui-kit` and `ui-kit/utils`
// (`import * as ui from 'ui-kit'`). Pass them as `modules` to `Live.Dnd`,
// `Live.Preview` or `compile()`, merged with any of your own.
export const uiKitModules = {
  'ui-kit': ui,
  'ui-kit/utils': utils,
};
