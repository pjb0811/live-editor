---
'@jbpark/live-editor': major
---

Redesign `Live.Dnd`'s customization surface around components and hooks instead of render props. Not customizing behaves exactly as before; customizing now reaches the layout, the palette and the panel through the same mechanism.

`renderPalette` and `renderPanel` are **removed**. What they handed over is now published as data through three hooks, and a replacement is an ordinary component rendered inside `Live.Dnd`:

```tsx
import { useDndPanel } from '@jbpark/live-editor/dnd';

const MyPanel = () => {
  const { item, bindings, onNodeChange } = useDndPanel();
  // ...
};

<Live.Dnd value={value} onChange={setValue}>
  <Live.Dnd.Layout panel={<MyPanel />} />
</Live.Dnd>;
```

Why: a render prop can't hold state. Every non-trivial custom panel ended up extracting a component anyway and re-passing data it had already been handed — the shipped demo's validated field, slider and headless items editor are all this shape. A component reads what it needs where it needs it.

**Migration**

| Before                                | After                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `renderPalette={data => ...}`         | a component calling `useDndPalette()`, passed as `Live.Dnd.Layout`'s `palette` slot or placed in `children`                                             |
| `renderPanel={data => ...}`           | a component calling `useDndPanel()`, passed as the `panel` slot or placed in `children`                                                                 |
| `PaletteRenderData`                   | `DndPalette` — `{ items, onAdd }`. `DraggableItem` is now the export `Live.Dnd.DraggableItem`; `isMobile` moved to `useDndLayout()`                     |
| `PanelRenderData`                     | `DndPanel` — same fields                                                                                                                                |
| `<Live.Dnd.DefaultPanel {...data} />` | `<Live.Dnd.Panel />` — it reads `useDndPanel()` itself, so there's nothing left to spread and `onNodeChange` can't be dropped on the way through (#308) |
| `Live.Dnd.DefaultLayout`              | `Live.Dnd.Layout`                                                                                                                                       |
| `PanelProps`                          | no longer public — the built-in panel takes no data props                                                                                               |

New in this release:

- **`children` replaces the arrangement**, not just the content. `Live.Dnd.Palette`, `Live.Dnd.Canvas` and `Live.Dnd.Panel` are the three regions, each in the container it needs; put them wherever you want (a vertical stack, tabs, CSS grid areas) as long as they're inside `Live.Dnd`, which keeps owning the drag context they share. `Canvas` is the one that can't be replaced — it carries the droppable, the sortable list, and the scroll container each section's iframe measures itself against.
- **`Live.Dnd.Layout` takes `palette`/`panel` slots**, so swapping one region out doesn't mean rebuilding the 3-pane Splitter and the mobile Drawers around it. A slot is placed in both the desktop pane and the mobile Drawer.
- **`useDndLayout()`** returns the state the built-in mobile chrome runs on (`isMobile`, `selectedId`, `clearSelection`, `paletteOpen`, `setPaletteOpen`) — needed because supplying `children` replaces the floating palette button and both Drawers along with the Splitter.
- `Palette`, `Canvas`, `Panel`, `Layout`, `useDndPalette`, `useDndPanel`, `useDndLayout`, `DndPalette`, `DndPanel`, `DndLayout`, `DndLayoutProps` and `DndRegionProps` are exported from the `dnd` subpath; the `Dnd*` types also from the package root.

One behaviour change beyond the API: `isMobile` now follows the breakpoint rather than "am I inside the mobile Drawer" — the same value in the built-in layout, and the right one for a custom layout that puts the palette elsewhere on touch, since tap-to-add is about the input device.

Naming: dropping the render props is also what retires the `Default` prefix. `Live.Dnd.Panel` used to be the _slot_ a panel landed in, which is why the built-in panel component had to be `DefaultPanel`. With no slot to disambiguate against, each name refers to one thing.
