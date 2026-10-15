import { useContext, useEffect, useRef } from 'react';

import type { PanelBinding, PanelNodeChange } from '../panel-binding';
import { ElementSelectionContext } from './element-selection';
import Field from './field';
import LabeledField from './labeled-field';

interface Props extends Omit<React.ComponentPropsWithoutRef<'div'>, 'id'> {
  // The element's `data-id`. Absent for an element the editor can't
  // address, whose card can't be picked or hovered.
  id?: string;
  header?: React.ReactNode;
  bindings: PanelBinding[];
  onNodeChange?: PanelNodeChange;
}

// How long a newly marked card keeps itself in view. Fields above it can
// still grow for a moment after it renders (a rich-text editor mounting,
// for one) and push it back out.
const KEEP_IN_VIEW_MS = 600;

// One element's card in the panel: its fields, each under its label, and
// anything passed as `children` after them. The card carries the
// element's `data-id`, which the panel reads to outline the element on the
// canvas, and marks itself with `data-picked` while the selection holds its
// id (#432, #643). Its look is the caller's, through `className`.
const ElementFields = ({
  id,
  header,
  bindings,
  onNodeChange,
  children,
  ...props
}: Props) => {
  const { ids, scrollRootRef } = useContext(ElementSelectionContext);

  const ref = useRef<HTMLDivElement>(null);

  const isPicked = id !== undefined && ids.has(id);

  useEffect(() => {
    const card = ref.current;

    if (!isPicked || !card) {
      return;
    }

    const until = performance.now() + KEEP_IN_VIEW_MS;
    let frame = 0;

    const keepInView = () => {
      const root = scrollRootRef?.current;
      const box = card.getBoundingClientRect();
      const view = root?.getBoundingClientRect();

      if (!view || box.top < view.top || box.bottom > view.bottom) {
        card.scrollIntoView?.({ block: 'nearest' });
      }

      if (performance.now() < until) {
        frame = requestAnimationFrame(keepInView);
      }
    };

    keepInView();

    return () => cancelAnimationFrame(frame);
  }, [isPicked, scrollRootRef]);

  return (
    <div
      {...props}
      ref={ref}
      data-node-id={id}
      data-picked={isPicked ? '' : undefined}
    >
      {header}
      {bindings.length > 0 && (
        <div className="space-y-2 rounded">
          <div className="space-y-1">
            {/* Keyed by `property` and `label`, since two bindings can share
                a label (#318). */}
            {bindings.map(binding => (
              <div
                key={`${binding.property}-${binding.label}`}
                className="space-y-1"
              >
                <LabeledField
                  binding={binding}
                  labelClassName="block text-xs font-semibold text-gray-700"
                  label={
                    <>
                      {binding.label}
                      <span className="ml-1 text-gray-400">
                        ({binding.property})
                      </span>
                    </>
                  }
                >
                  <Field binding={binding} onNodeChange={onNodeChange} />
                </LabeledField>
              </div>
            ))}
          </div>
        </div>
      )}
      {children}
    </div>
  );
};

export default ElementFields;
