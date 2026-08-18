import type { BindingItem } from '~/utils/ast/types';

// Authored `data-binding` attributes are plain array literals parsed
// statically out of the JSX source text (see src/utils/ast/binding.ts) — they
// are never actually evaluated as React props at runtime. This augmentation
// only exists to give editors/tsc real autocomplete and type-checking while
// authoring them (e.g. in the interactive demos), instead of the
// default permissive `data-*` attribute typing that accepts anything.
declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match the merged interface's type param name
  interface HTMLAttributes<T> {
    'data-binding'?: BindingItem[];
  }
}
