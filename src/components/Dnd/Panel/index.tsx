import { useMemo } from 'react';

import { Typography } from '@jbpark/ui-kit';

import type { Section } from '~/types';
import { cn } from '~/utils';
import { extract, fillIds, update } from '~/utils/ast';

import Node from './Node';

interface Props {
  item?: Section;
  onChange?: (next: Partial<Section>) => void;
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
      console.warn('⚠️ 파싱 에러', e);
      return { dataAttrNodes: [], updatedCode: '' };
    }
  }, [item?.code]);

  if (!item) {
    return (
      <Typography.Text
        className={cn(
          'p-4 text-sm text-gray-500',
          //
        )}
      >
        섹션을 선택하세요.
      </Typography.Text>
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
      <Typography.Title className="text-lg font-semibold">
        {item.name}
      </Typography.Title>
      {!dataAttrNodes.length && (
        <Typography.Text className="text-xs text-gray-400">
          편집 가능한 요소가 없습니다.
        </Typography.Text>
      )}
      {dataAttrNodes.map((node, index) => (
        <Node
          key={`${item.id}-${index}`}
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
