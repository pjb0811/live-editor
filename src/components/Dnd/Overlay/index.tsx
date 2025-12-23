import { useDndContext } from '@dnd-kit/core';

import { type Dnd as DndType } from '~/types';

import Draggable from '../Draggable';
import Renderer from '../Renderer';
import Sortable from '../Sortable';

interface Props {
  sections: DndType.Section[];
  renderProps: {
    fullCode: string;
    modules: Record<string, unknown>;
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
