import type { Section } from '~/types';
import type {
  BindingKeyMap,
  BindingOptions,
  BindingRegistry,
} from '~/utils/ast/types';

import type { FrameProps } from '../frame';
import type { DndEditError, DndRenderField } from './edit-options';
import type { DndNodePick } from './inspector';
import type {
  PanelBinding,
  PanelNodeChange,
  PanelNodesChange,
} from './panel-binding';
import type { DndRenderSectionFallback } from './section-fallback-context';

// The public types of `Live.Dnd`, apart from the component, so the files
// that use them don't import the component file.

// What `useDndPalette()` returns. Data only: dragging comes from
// `Live.Dnd.DraggableItem`, and the breakpoint from `useDndLayout()`.
export interface DndPalette {
  items: Section[];
  // Adds the item at the end of the canvas and closes the mobile palette
  // Drawer.
  onAdd: (item: Section) => void;
}

// What `useDndPanel()` returns: everything the built-in panel uses, so a
// custom panel works from the same data.
export interface DndPanel {
  item?: Section;
  onChange: (next: Partial<Section>) => void;
  onDelete: (id: string) => void;
  // Move the selected section. On mobile the panel covers the canvas, so
  // these replace dragging there.
  onMoveUp: () => void;
  onMoveDown: () => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  // The editable fields of `item`, one entry per bound property. Each has
  // the binding's `type`, its current `value`, and an `onChange` that commits
  // the same way the built-in panel does, errors included. Switch on `type`
  // to render your own control.
  bindings: PanelBinding[];
  // Commits one field by its element's `data-id`. It reaches elements that
  // aren't in `bindings`: data-bound JSX inside an `items` or `children`
  // value, which the top-level `extract()` doesn't read. Pass it to
  // `Live.Dnd.Field` with the binding, or edits inside those values aren't
  // saved (#308).
  onNodeChange: PanelNodeChange;
  // Several field edits as one commit, applied in order, all or none. Use it
  // when one action writes more than one binding, such as an image picker
  // that sets `src` and `alt`: the host gets one `onChange`, and a failure
  // leaves nothing half-applied (#425).
  onNodesChange: PanelNodesChange;
  // True while the document doesn't parse: `item` and `bindings` are from the
  // last version that did, and every commit is refused (and reported through
  // `onEditError`) until the source parses again. Disable your controls, or
  // say why edits aren't landing (#433).
  readOnly: boolean;
  // `Live.Dnd`'s `bindings` and `bindingKeys`. Pass it to `extract()` when a
  // custom panel reads a section's elements itself, so they get the same
  // fields the built-in panel shows (#513).
  bindingOptions: BindingOptions;
}

export interface Props extends Omit<
  React.ComponentPropsWithRef<'div'>,
  'onChange'
> {
  value?: string;
  props?: Record<string, unknown>;
  modules?: Record<string, unknown>;
  items?: Section[];
  frame?: FrameProps;
  dynamicTailwind?: boolean;
  provider?: (children: React.ReactNode) => React.ReactNode;
  onChange?: (value: string) => void;
  // Replaces the built-in control for any field, wherever it renders — the
  // built-in panel, `Live.Dnd.Field` in a custom panel, nested object keys
  // and array item properties. Return `undefined` to keep the built-in one.
  // See `DndRenderField`.
  renderField?: DndRenderField;
  // Receives every edit the editor could not apply. When set, the built-in
  // error toast is not shown; the payload carries the same title and
  // description so a host can show them its own way.
  onEditError?: (error: DndEditError) => void;
  // Renders in place of a canvas section that failed to compile, threw while
  // rendering, or was skipped by `shouldForceSectionFallback`. Return
  // `undefined` for the built-in error box. See `DndSectionFallbackArgs`.
  renderSectionFallback?: DndRenderSectionFallback;
  // Checked for every section before it is compiled. Return `true` to skip
  // compiling it (so none of its top-level code runs) and render the
  // fallback with reason `forced`.
  shouldForceSectionFallback?: (section: Section) => boolean;
  // Asked before a section is deleted, from the canvas, the panel, or a
  // custom panel's `onDelete`. Return `false` (or a promise of it) to keep the
  // section; use it to show your own confirmation. Deleting is immediate and
  // has no undo inside `Live.Dnd`, so this is the host's chance to ask (#435).
  onBeforeDelete?: (section: Section) => boolean | Promise<boolean>;
  // Names a section whose `<section>` has no `data-name`, from its 0-based
  // position on the canvas. The name shows on the canvas, in the panel and
  // in `renderSectionFallback`'s `section`. Defaults to "Section 1",
  // "Section 2", ...
  sectionNameFallback?: (index: number) => string;
  // The `id` of the element whose `<section>` children are the document's
  // sections. Defaults to `app-container`. A document without that element
  // has no sections, and `onEditError` (or the toast) says so. Start a new
  // document with `createDocument({ containerId })` from
  // `@jbpark/live-editor/utils`. Without a `value`, `Live.Dnd` starts from
  // the default template, which uses `app-container`, so pass a `value`
  // when you change this.
  containerId?: string;
  // Bindings for every element of a component, keyed by its tag name as
  // written (`ui.Button`, `Button`), so the markup only needs a `data-id`.
  // HTML element keys (`p`, `h2`) are ignored. An element's own
  // `data-binding`, even `data-binding={[]}`, takes precedence. Define it
  // once outside render: a new object each render re-reads every section
  // (#509).
  bindings?: BindingRegistry;
  // Bindings an element asks for by name: `data-binding-key="hero-title"` in
  // its markup gets the entries under `hero-title` here, on an HTML element
  // or a component alike. Comes after the element's own `data-binding` and
  // before `bindings`. Plain data, so it can come from JSON; define it once
  // outside render, like `bindings` (#513).
  bindingKeys?: BindingKeyMap;
  // Called when an element is picked in the canvas preview with the element
  // picker (`useDndInspector()`, or the canvas's picker button). Receives the
  // element's `data-id`, the key its fields carry in `useDndPanel()`, and its
  // section's id. The section is selected as well (#432).
  onNodePick?: (pick: DndNodePick) => void;
  // The single customization slot. Omit it for the built-in editor. Supply
  // it and you own the arrangement: compose `Live.Dnd.Palette` /
  // `Live.Dnd.Canvas` / `Live.Dnd.Panel` (each the built-in region, in the
  // container it needs) and your own components in any structure you like.
  // The drag context wraps all of it, so drag-and-drop and field editing
  // keep working wherever a region lands. Your components read the same data
  // the built-ins do through `useDndPalette()` / `useDndPanel()` /
  // `useDndLayout()`.
  //
  // Note this replaces the mobile chrome too — the FAB and both Drawers live
  // in `Live.Dnd.Layout`, which is what runs when children are omitted.
  // Render it yourself (`<Live.Dnd.Layout panel={<MyPanel />} />`) to keep
  // the built-in arrangement while swapping one region. Render `Canvas` at
  // most once either way.
  children?: React.ReactNode;
}
