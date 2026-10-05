import type { BindingItem } from '~/utils/ast/types';

// Types `data-binding` in JSX for editor autocomplete and type checks. The
// library reads it from the source, never as a runtime prop.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match the merged interface's type param name
  interface HTMLAttributes<T> {
    'data-binding'?: BindingItem[];
  }
}
