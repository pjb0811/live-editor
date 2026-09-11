import { Button, Drawer, Space, Splitter } from '@jbpark/ui-kit';
import { LayoutGrid } from 'lucide-react';

import { cn } from '~/utils';

import { DefaultDraggableItem } from './draggable';
import { useDndRegions } from './layout-context';
import PropertyPanel from './panel';

// The regions take their content from context, so `children` is never a
// consumer's to pass — everything else about the wrapper div is (className
// is tailwind-merged over the defaults, so overriding one of them wins
// rather than fighting).
export type DndRegionProps = Omit<
  React.ComponentPropsWithRef<'div'>,
  'children'
>;

// The built-in palette and panel without their region wrapper. Both exist
// because `Layout` renders them twice on mobile — once in a pane, once in a
// Drawer that's already the scroll container and shouldn't inherit the
// pane's background.
const PaletteItems = ({ subject }: { subject: string }) => {
  const {
    palette: { items, onAdd },
    isMobile,
  } = useDndRegions(subject);

  return (
    <Space orientation="vertical" align="start">
      {items.map(item => (
        <DefaultDraggableItem
          key={item.id}
          item={item}
          onAdd={onAdd}
          tapToAdd={isMobile}
        />
      ))}
    </Space>
  );
};

const PanelFields = ({ subject }: { subject: string }) => {
  const {
    panel: {
      item,
      onDelete,
      onMoveUp,
      onMoveDown,
      canMoveUp,
      canMoveDown,
      bindings,
      onNodeChange,
    },
  } = useDndRegions(subject);

  return (
    <PropertyPanel
      item={item}
      onDelete={onDelete}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      bindings={bindings}
      onNodeChange={onNodeChange}
    />
  );
};

// The built-in palette, in the scroll container the desktop pane wants.
// Replace it by putting your own component in `Layout`'s `palette` slot, or
// anywhere in `Live.Dnd`'s children — `useDndPalette()` hands over the same
// items and `onAdd` this reads.
export const Palette = ({ className, ...restProps }: DndRegionProps) => (
  <div
    className={cn(
      'h-full overflow-y-auto bg-gray-50 p-4',
      className,
      //
    )}
    {...restProps}
  >
    <PaletteItems subject="<Live.Dnd.Palette>" />
  </div>
);

// Owns the scroll container each section's iframe resolves by
// `closest('[data-frame-container]')` to size itself against (see
// frame/iframe.tsx), plus the containment/isolation styles that keep a
// section's compiled CSS out of the editor chrome — hence a region rather
// than a plain slot: a custom layout can move it, not lose it. Needs a
// height-constrained parent, since it fills one (`h-full`). Render it
// exactly once — the droppable and the sortable list inside use fixed ids,
// and a second instance would duplicate both.
export const Canvas = ({ className, style, ...restProps }: DndRegionProps) => {
  const { canvas } = useDndRegions('<Live.Dnd.Canvas>');

  return (
    <div
      className={cn(
        'relative h-full w-full overflow-y-auto',
        className,
        //
      )}
      data-frame-container
      style={{
        isolation: 'isolate',
        contain: 'layout style',
        transform: 'translateZ(0)',
        ...style,
      }}
      {...restProps}
    >
      {canvas}
    </div>
  );
};

// The built-in property panel. Same deal as `Palette`: replace it via
// `Layout`'s `panel` slot or by placing your own component in `Live.Dnd`'s
// children, driving it from `useDndPanel()`.
export const Panel = ({ className, ...restProps }: DndRegionProps) => (
  <div
    className={cn(
      'h-full',
      className,
      //
    )}
    {...restProps}
  >
    <PanelFields subject="<Live.Dnd.Panel>" />
  </div>
);

export interface DndLayoutProps {
  // Replacements for the palette/panel regions, kept as slots so swapping
  // one out doesn't mean rebuilding the 3-pane Splitter and the mobile
  // Drawers around it. A slot is placed raw — it owns its own container,
  // unlike the built-in regions, which bring theirs. Drive it from
  // `useDndPalette()` / `useDndPanel()`.
  palette?: React.ReactNode;
  panel?: React.ReactNode;
}

// What `Live.Dnd` renders when given no children — the 3-pane desktop
// Splitter, the stacked mobile canvas, and the mobile FAB/Drawers. Exported
// so children can keep the built-in arrangement while wrapping it (a toolbar
// above it, say) or while replacing just one region — and because
// `@jbpark/ui-kit` is a dependency rather than a peer, so `Splitter` isn't
// necessarily importable on the consumer's side.
export const Layout = ({ palette, panel }: DndLayoutProps) => {
  const { isMobile, selectedId, clearSelection, paletteOpen, setPaletteOpen } =
    useDndRegions('<Live.Dnd.Layout>');

  return (
    <>
      {isMobile ? (
        <Canvas />
      ) : (
        <Splitter withHandle orientation="horizontal">
          <Splitter.Panel
            defaultSize="20%"
            minSize="15%"
            maxSize="35%"
            collapsible
          >
            {palette ?? <Palette />}
          </Splitter.Panel>
          <Splitter.Panel defaultSize="60%">
            <Canvas />
          </Splitter.Panel>
          <Splitter.Panel
            defaultSize="20%"
            minSize="15%"
            maxSize="35%"
            collapsible
          >
            {panel ?? <Panel />}
          </Splitter.Panel>
        </Splitter>
      )}
      <Button
        type="primary"
        shape="circle"
        icon={<LayoutGrid />}
        aria-label="Components"
        className="fixed right-4 bottom-4 z-20 md:hidden"
        onClick={() => setPaletteOpen(true)}
      />
      {/* A slot goes in as-is; the built-ins go in without their region
          wrapper, since the Drawer is already the scroll container and the
          palette's gray background belongs to the desktop pane. */}
      <Drawer
        open={isMobile && paletteOpen}
        onClose={() => setPaletteOpen(false)}
        direction="bottom"
        size="large"
        title="Components"
      >
        {palette ?? <PaletteItems subject="<Live.Dnd.Layout>" />}
      </Drawer>
      <Drawer
        open={isMobile && Boolean(selectedId)}
        onClose={clearSelection}
        direction="bottom"
        size="large"
        title="Properties"
      >
        {panel ?? <PanelFields subject="<Live.Dnd.Layout>" />}
      </Drawer>
    </>
  );
};

export default Layout;
