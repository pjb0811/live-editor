import { useState } from 'react';

import { Switch } from '@jbpark/ui-kit';
import { TriangleAlert } from 'lucide-react';

import type { DndRenderSectionFallback } from '~/components/dnd';
import { DRAGGABLE_ITEMS } from '~/constants';
import Live from '~/index';
import type { Section } from '~/types';

import { documentWith } from '../shared/documents';
import { IFRAME_FRAME } from '../shared/frames';

// Throws while rendering, so the canvas shows its fallback with reason
// `runtime`. Fix the code in the panel's source to see it recover.
const THROWING: Section = {
  id: 'throwing',
  name: 'Throws while rendering',
  code: `
      <section data-name="Throws while rendering" className="p-8">
        {(() => {
          throw new Error('This section throws on purpose.');
        })()}
      </section>
    `,
};

// Healthy, but `shouldForceSectionFallback` can skip compiling it (reason
// `forced`), the way a host might hold back a section it doesn't trust.
const FORCEABLE: Section = {
  id: 'forceable',
  name: 'Forced fallback',
  code: `
      <section data-name="Forced fallback" className="p-8 text-center">
        <h2 data-id="" data-binding={[{ label: 'Heading', property: 'innerText' }]} className="text-2xl font-bold">
          This section renders unless its fallback is forced
        </h2>
      </section>
    `,
};

const INITIAL_DOCUMENT = documentWith([
  DRAGGABLE_ITEMS[0],
  THROWING,
  FORCEABLE,
]);

const customFallback: DndRenderSectionFallback = ({
  section,
  reason,
  message,
}) => (
  <div
    className="flex items-start gap-3 border-2 border-dashed border-amber-400
      bg-amber-50 p-6 text-amber-900"
  >
    <TriangleAlert size={20} className="shrink-0" />
    <div className="min-w-0 text-sm">
      <p className="font-semibold">
        {section.name} <span className="font-normal">({reason})</span>
      </p>
      {message && <p className="mt-1 font-mono text-xs break-all">{message}</p>}
    </div>
  </div>
);

// What `Live.Dnd` shows for a section that can't render: the built-in error
// box, or the host's own through `renderSectionFallback`, and a section the
// host chooses not to compile through `shouldForceSectionFallback`.
const Fallback = () => {
  const [value, setValue] = useState(INITIAL_DOCUMENT);
  const [custom, setCustom] = useState(true);
  const [forced, setForced] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b
          border-gray-200 px-3 py-1.5 text-xs"
      >
        <label className="flex items-center gap-1.5">
          <Switch size="small" checked={custom} onChange={setCustom} />
          renderSectionFallback: custom
        </label>
        <label className="flex items-center gap-1.5">
          <Switch size="small" checked={forced} onChange={setForced} />
          shouldForceSectionFallback: "Forced fallback"
        </label>
      </div>
      <div className="min-h-0 flex-1">
        <Live>
          <Live.Dnd
            frame={IFRAME_FRAME}
            items={DRAGGABLE_ITEMS}
            value={value}
            onChange={setValue}
            renderSectionFallback={custom ? customFallback : undefined}
            shouldForceSectionFallback={section =>
              forced && section.name === FORCEABLE.name
            }
            className="h-full"
          />
        </Live>
      </div>
    </div>
  );
};

export default Fallback;
