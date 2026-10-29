import type { DndRenderField } from '~/components/dnd/edit-options';
import {
  type FieldKind,
  getFieldKind,
} from '~/components/dnd/panel/fields/field-kind';

import UiKitField from './ui-kit-field';

// The field kinds `uiKitFields` draws with ui-kit. The rest keep the
// built-in control.
const UI_KIT_KINDS: ReadonlySet<FieldKind> = new Set([
  'richtext',
  'boolean',
  'select',
  'color',
  'date',
  'datetime',
  'time',
]);

// A `renderField` that draws the rich text, checkbox, select, color, date,
// datetime and time fields with `@jbpark/ui-kit` and keeps the built-in
// control for the rest. To combine it with your own, call it last:
// `(props, builtin) => mine(props) ?? uiKitFields(props, builtin)`.
export const uiKitFields: DndRenderField = props =>
  UI_KIT_KINDS.has(getFieldKind(props.binding)) ? (
    <UiKitField {...props} />
  ) : undefined;
