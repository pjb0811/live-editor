import { Drawer, Splitter } from '@jbpark/ui-kit';
import { Crosshair, LayoutGrid } from 'lucide-react';

import { useLiveMessages } from '~/components/context/messages';
import { cn } from '~/utils/cn';

import styles from './layout.module.css';

import Button from './button';
import { useDndInspector } from './inspector';
import { useDndRegions } from './layout-context';
import { DefaultDraggableItem } from './palette/draggable';
import PropertyPanel from './panel';

// A region's props: everything a `div` takes except `children`, which comes
// from context. The region's styles sit in the `components` cascade layer,
// so a Tailwind utility or an unlayered rule in `className` wins.
export type DndRegionProps = Omit<
  React.ComponentPropsWithRef<'div'>,
  'children'
>;

// The built-in palette and panel without their region wrapper, for the
// mobile Drawers, which are already the scroll container.
const PaletteItems = ({ subject }: { subject: string }) => {
  const {
    palette: { items, onAdd },
    isMobile,
  } = useDndRegions(subject);

  return (
    <div className={styles.paletteItems}>
      {items.map(item => (
        <DefaultDraggableItem
          key={item.id}
          item={item}
          onAdd={onAdd}
          tapToAdd={isMobile}
        />
      ))}
    </div>
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
      readOnly,
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
      readOnly={readOnly}
    />
  );
};

// The built-in palette in its scroll container. To replace it, put your
// own component in `Layout`'s `palette` slot or anywhere in `Live.Dnd`'s
// children, and read `useDndPalette()`.
export const Palette = ({ className, ...restProps }: DndRegionProps) => (
  <div className={cn(styles.palette, className)} {...restProps}>
    <PaletteItems subject="<Live.Dnd.Palette>" />
  </div>
);

// The canvas in its scroll container, which each section's iframe sizes
// itself against (`data-frame-container`), with the styles that keep a
// section's CSS out of the editor. Needs a parent with a fixed height.
// Render it exactly once: the drop area and sortable list inside use fixed
// ids.
export const Canvas = ({ className, style, ...restProps }: DndRegionProps) => {
  const { canvas, documentError } = useDndRegions('<Live.Dnd.Canvas>');
  const inspector = useDndInspector();
  const messages = useLiveMessages();

  return (
    <div
      className={cn(styles.canvas, className)}
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
      {/* The element picker's switch (#432). Pinned to the bottom-left of
          the scroll area, clear of the selected section's own buttons at its
          top-right and of the mobile palette button at the bottom-right. */}
      {!documentError && (
        <div className={styles.pickerDock}>
          <div className={styles.picker}>
            <Button
              icon={<Crosshair />}
              tone="primary"
              variant={inspector.active ? 'solid' : 'outlined'}
              aria-pressed={inspector.active}
              aria-label={messages.canvas.pickElement}
              title={
                inspector.active
                  ? messages.canvas.pickElementActive
                  : messages.canvas.pickElement
              }
              onClick={inspector.toggle}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// The built-in property panel. Replace it like `Palette`, through
// `Layout`'s `panel` slot or `Live.Dnd`'s children, reading `useDndPanel()`.
export const Panel = ({ className, ...restProps }: DndRegionProps) => (
  <div className={cn(styles.panel, className)} {...restProps}>
    <PanelFields subject="<Live.Dnd.Panel>" />
  </div>
);

export interface DndLayoutProps {
  // Your own palette or panel in place of the built-in one, keeping the
  // rest of the layout. A slot is placed as is and brings its own
  // container. Read `useDndPalette()` / `useDndPanel()` in it.
  palette?: React.ReactNode;
  panel?: React.ReactNode;
}

// What `Live.Dnd` renders without children: a three-pane Splitter on
// desktop, and on mobile the canvas with a button and Drawers.
export const Layout = ({ palette, panel }: DndLayoutProps) => {
  const { isMobile, selectedId, clearSelection, paletteOpen, setPaletteOpen } =
    useDndRegions('<Live.Dnd.Layout>');
  const messages = useLiveMessages();

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
        variant="solid"
        tone="primary"
        shape="circle"
        icon={<LayoutGrid />}
        aria-label={messages.canvas.palette}
        className={styles.paletteButton}
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
        title={messages.canvas.palette}
      >
        {palette ?? <PaletteItems subject="<Live.Dnd.Layout>" />}
      </Drawer>
      <Drawer
        open={isMobile && Boolean(selectedId)}
        onClose={clearSelection}
        direction="bottom"
        size="large"
        title={messages.canvas.properties}
      >
        {panel ?? <PanelFields subject="<Live.Dnd.Layout>" />}
      </Drawer>
    </>
  );
};

export default Layout;
