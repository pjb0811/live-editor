import { createContext, useContext } from 'react';

import { Toast } from '@jbpark/ui-kit';

import type { UpdateFailure } from '~/utils/ast';

import type { FieldProps } from './panel/field';

// Everything the editor reports instead of applying an edit. `title` and
// `description` are the messages the built-in toast shows, so a host that
// routes these elsewhere can reuse them rather than rewording every case.
export type DndEditError =
  | {
      // `update()` rejected a field edit. `failure.reason` says why — most
      // often a `property`/`label` in the element's data-binding that doesn't
      // match its markup.
      type: 'update';
      id: string;
      label: string;
      property: string;
      failure: UpdateFailure | undefined;
      title: string;
      description?: string;
    }
  | {
      // The selected section's source, or an `items` value inside it, did
      // not parse. Nothing in it can be edited from the panel until it does.
      type: 'parse';
      target: 'section' | 'items';
      error?: unknown;
      title: string;
      description?: string;
    }
  | {
      // An array edit could not be applied without losing source (a spread,
      // a hole, unsupported syntax). The source was left unchanged.
      type: 'items';
      title: string;
      description?: string;
    };

// Called before the built-in control for every field — top-level, nested
// object keys and array item properties alike. Return a node to render it
// instead, `null` to render nothing, or `undefined` to keep `builtin`.
// `builtin` is the control that would have rendered, so a renderer can wrap
// it rather than replace it; don't render `<Live.Dnd.Field>` from here, since
// that calls this function again.
export type DndRenderField = (
  props: FieldProps,
  builtin: React.ReactElement,
) => React.ReactNode | undefined;

interface DndEditOptions {
  renderField?: DndRenderField;
  reportError: (error: DndEditError) => void;
}

export const toastEditError = (error: DndEditError) => {
  Toast.error(
    error.title,
    error.description ? { description: error.description } : undefined,
  );
};

// A context rather than props threaded through every editor: `Field` renders
// itself recursively and inside `Items`/`Children`, and a custom panel
// renders it directly, so this is the one way every field sees the same
// options. The default keeps `Field`/`useItemsEditor` working outside
// `Live.Dnd`, reporting through the toast as before.
export const DndEditOptionsContext = createContext<DndEditOptions>({
  reportError: toastEditError,
});

export const useDndEditOptions = () => useContext(DndEditOptionsContext);
