import { useDndContext } from '@dnd-kit/core';

import type { FrameProps } from '~/components/frame';
import type { Section } from '~/types';
import { generateSection } from '~/utils/sections';

import { DefaultDraggableItem } from './draggable';
import { paletteSectionOf } from './palette-drag';
import Renderer from './renderer';
import Sortable from './sortable';

interface Props {
  sections: Section[];
  isForced?: (section: Section) => boolean;
  renderProps: {
    fullCode: string;
    containerId?: string;
    modules: Record<string, unknown>;
    frame?: FrameProps;
    dynamicTailwind?: boolean;
  };
}

const Overlay = ({ sections, isForced, renderProps }: Props) => {
  const { active } = useDndContext();

  if (!active) {
    return null;
  }

  const paletteSection = paletteSectionOf(active.data);

  if (paletteSection) {
    return <DefaultDraggableItem item={paletteSection} />;
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
        />
      </Sortable>
    );
  }

  return null;
};

export default Overlay;
