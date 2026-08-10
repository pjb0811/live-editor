import { useDndContext } from '@dnd-kit/core';

import type { FrameProps } from '~/components/frame';
import type { Section } from '~/types';
import { generateSection } from '~/utils';

import { DefaultDraggableItem } from './draggable';
import Renderer from './renderer';
import Sortable from './sortable';

interface Props {
  sections: Section[];
  renderProps: {
    fullCode: string;
    modules: Record<string, unknown>;
    frame?: FrameProps;
  };
}

const Overlay = ({ sections, renderProps }: Props) => {
  const { active } = useDndContext();

  if (!active) {
    return null;
  }

  if (active.data.current?.type === 'new-item') {
    const item = active.data.current.item;

    return <DefaultDraggableItem item={item} />;
  }

  const section = sections.find(s => s.id === active.id);

  if (section) {
    const preview = generateSection(section.code, renderProps.fullCode);

    return (
      <Sortable id={section.id} name={section.name}>
        <Renderer
          preview={preview}
          modules={renderProps.modules}
          frame={renderProps.frame}
        />
      </Sortable>
    );
  }

  return null;
};

export default Overlay;
