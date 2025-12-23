import { useMemo } from 'react';

import { type Dnd as DndType } from '~/types';
import { cn } from '~/utils';
import { extract, fillIds, update } from '~/utils/ast';

import Node from './Node';

interface Props {
  item?: DndType.Section;
  onChange?: (next: Partial<DndType.Section>) => void;
}

const Panel = ({ item, onChange }: Props) => {
  const { dataAttrNodes, updatedCode } = useMemo(() => {
    if (!item?.code) {
      return { dataAttrNodes: [], updatedCode: '' };
    }

    try {
      const updatedCode = fillIds(item.code);

      const allNodes = extract(updatedCode);
      const filtered = allNodes.filter(node => node.tagName !== 'section');

      return {
        dataAttrNodes: filtered,
        updatedCode: updatedCode !== item.code ? updatedCode : item.code,
      };
    } catch (e) {
      console.warn('parse error', e);
      return { dataAttrNodes: [], updatedCode: '' };
    }
  }, [item?.code]);

  if (!item) {
    return (
      <div
        className={cn(
          'p-4 text-sm text-gray-500',
          //
        )}
      >
        섹션을 선택하세요.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'h-full space-y-4 p-4',
        'overflow-x-hidden overflow-y-auto',
        //
      )}
    >
      <h3 className="text-lg font-semibold">{item.name}</h3>
      {!dataAttrNodes.length && (
        <div className="text-xs text-gray-400">
          편집 가능한 요소가 없습니다.
        </div>
      )}

      {dataAttrNodes.map((node, index) => (
        <Node
          key={index}
          data={node}
          onChange={({ id, label, value }) => {
            onChange?.({
              ...item,
              code: update(updatedCode, id, label, value),
            });
          }}
        />
      ))}
    </div>
  );
};

export default Panel;
