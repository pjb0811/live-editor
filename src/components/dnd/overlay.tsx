import { useDndContext } from '@dnd-kit/core';

import type { FrameProps } from '~/components/frame';
import type { Section } from '~/types';

import Draggable from './draggable';
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

    return <Draggable item={item} />;
  }

  const section = sections.find(s => s.id === active.id);

  if (section) {
    return (
      <Sortable id={section.id} name={section.name}>
        <Renderer {...renderProps} code={section.code} />
      </Sortable>
    );
  }

  return null;
};

export default Overlay;
