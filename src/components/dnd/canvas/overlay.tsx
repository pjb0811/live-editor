import { useDndContext } from '@dnd-kit/core';

import type { FrameProps } from '~/components/frame';
import type { Section } from '~/types';
import { generateSection } from '~/utils/sections';

import { DefaultDraggableItem } from '../palette/draggable';
import { paletteSectionOf } from '../palette/palette-drag';
import Renderer from './renderer';
import Sortable from './sortable';

interface Props {
  sections: Section[];
  // `Live.Dnd`'s `renderPaletteOverlay` (#780).
  renderPaletteOverlay?: (item: Section) => React.ReactNode | undefined;
  isForced?: (section: Section) => boolean;
  renderProps: {
    fullCode: string;
    containerId?: string;
    modules: Record<string, unknown>;
    frame?: FrameProps;
    dynamicTailwind?: boolean;
    componentProps?: Record<string, unknown>;
  };
}

const Overlay = ({
  sections,
  renderPaletteOverlay,
  isForced,
  renderProps,
}: Props) => {
  const { active } = useDndContext();

  if (!active) {
    return null;
  }

  const paletteSection = paletteSectionOf(active.data);

  if (paletteSection) {
    // The host's card first. Rendering a `DraggableItem` in it is fine:
    // dnd-kit's `DragOverlay` gives its children an empty drag context, as
    // the built-in card below relies on.
    const custom = renderPaletteOverlay?.(paletteSection);

    return custom === undefined ? (
      <DefaultDraggableItem item={paletteSection} />
    ) : (
      <>{custom}</>
    );
  }

  const section = sections.find(s => s.id === active.id);

  if (section) {
    const preview = generateSection(section.code, renderProps.fullCode, {
      containerId: renderProps.containerId,
    });

    return (
      <Sortable id={section.id} name={section.name}>
        <Renderer
          preview={preview}
          sectionId={section.id}
          sectionName={section.name}
          sectionCode={section.code}
          forceFallback={isForced?.(section) ?? false}
          modules={renderProps.modules}
          frame={renderProps.frame}
          dynamicTailwind={renderProps.dynamicTailwind}
          componentProps={renderProps.componentProps}
        />
      </Sortable>
    );
  }

  return null;
};

export default Overlay;
