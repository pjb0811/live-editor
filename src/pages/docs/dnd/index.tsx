import { useState } from 'react';

import { Typography } from '@jbpark/ui-kit';

import Live from '~/.';
import { DEFAULT_TEMPLATE } from '~/constants';
import { cn } from '~/utils';

const DndDoc = () => {
  const [value, setValue] = useState(DEFAULT_TEMPLATE);

  return (
    <div className="space-y-4">
      <Typography.Title level={1}>Drag & Drop</Typography.Title>
      <Typography.Paragraph className="text-gray-500">
        Drag a component from the left palette onto the canvas, then edit its
        properties from the panel on the right. Powered by <code>@dnd-kit</code>
        .
      </Typography.Paragraph>
      <Live>
        <div
          className={cn(
            'h-[550px] overflow-auto rounded-lg',
            'border border-gray-200',
          )}
        >
          <Live.Dnd
            value={value}
            onChange={setValue}
            frame={{
              mode: 'iframe',
              syncStyle: true,
              scripts: ['/js/tailwindcss.js'],
            }}
          />
        </div>
      </Live>
    </div>
  );
};

export default DndDoc;
