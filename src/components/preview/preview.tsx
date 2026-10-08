import Client from './client';
import { NO_MODULES, NO_PROPS } from './defaults';
import type { Props } from './types';

// `Live.Preview`: a thin wrapper around `Client`, which compiles, handles
// errors and wraps the frame. One render path for both `code` and the
// provider's code (#187).
const Preview = ({
  code,
  props = NO_PROPS,
  modules = NO_MODULES,
  dynamicTailwind = false,
  provider,
  ...restProps
}: Props) => {
  return (
    <Client
      code={code}
      props={props}
      modules={modules}
      dynamicTailwind={dynamicTailwind}
      provider={provider}
      {...restProps}
    />
  );
};

export default Preview;
