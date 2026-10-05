import * as ui from '@jbpark/ui-kit';
import * as utils from '@jbpark/ui-kit/utils';

// What every preview can import without the host passing it
// (`import * as ui from 'ui-kit'`). Kept here, not in `~/utils`, because
// loading ui-kit reaches its stylesheets, which would make `./utils`
// unloadable in Node (#372).
export const baseModules = {
  'ui-kit': ui,
  'ui-kit/utils': utils,
};
