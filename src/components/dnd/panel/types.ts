import type { PanelBinding, PanelNodeChange } from '../panel-binding';

// Props of `Live.Dnd.Field`, the built-in control for one binding. A custom
// panel can use it for any binding, most usefully `items` and `children`,
// whose editors find nested elements. Renders the control only; supply
// your own label.
export interface FieldProps {
  binding: PanelBinding;
  // Commits edits to elements other than `binding`'s own, which the Items
  // and Children editors make. Pass `useDndPanel().onNodeChange`; without it,
  // edits inside those values aren't saved (#308).
  onNodeChange?: PanelNodeChange;
}
