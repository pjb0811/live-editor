import { createContext, useContext } from 'react';

import { Toast } from '@jbpark/ui-kit';

import type { BindingOptions } from '~/utils/ast/types';
import type { UpdateFailure } from '~/utils/ast/update';

import type { FieldProps } from './panel/field';

// An edit the editor didn't apply. `title` and `description` are what the
// built-in toast shows, so a host can show them its own way.
export type DndEditError =
  | {
      // `update()` rejected a field edit. `failure.reason` says why, most
      // often a `property` or `label` that doesn't match the markup.
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
      // An edit was refused because the document doesn't parse; the canvas
      // and panel show the last version that did (#433). Reported when an
      // edit is attempted, not when the source stops parsing.
      type: 'parse';
      target: 'document';
      reason: 'parse-error';
      error: unknown;
      title: string;
      description?: string;
    }
  | {
      // The document has no element with the container id, so it has no
      // sections and nothing added from the palette can land. Reported once
      // each time a document reaches this state, not on every edit (#449).
      type: 'parse';
      target: 'document';
      reason: 'container-not-found';
      containerId: string;
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
  // `Live.Dnd`'s `bindings` and `bindingKeys`, for the editors that read
  // elements out of a value of their own, such as `useDndItems` (#509,
  // #513).
  bindingOptions?: BindingOptions;
}

export const toastEditError = (error: DndEditError) => {
  Toast.error(
    error.title,
    error.description ? { description: error.description } : undefined,
  );
};

// The edit options every `Field` reads, wherever it renders: nested, inside
// `Items` or `Children`, or in a custom panel. The default lets `Field` and
// `useDndItems` work outside `Live.Dnd`, reporting through the toast.
export const DndEditOptionsContext = createContext<DndEditOptions>({
  reportError: toastEditError,
});

export const useDndEditOptions = () => useContext(DndEditOptionsContext);
