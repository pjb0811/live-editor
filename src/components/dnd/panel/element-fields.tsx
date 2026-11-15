import { useContext, useEffect, useRef } from 'react';

import styles from './panel.module.css';

import type { PanelBinding, PanelNodeChange } from '../panel-binding';
import { readDescription, readGroup } from './binding-meta';
import { ElementSelectionContext } from './element-selection';
import Field from './field';
import LabeledField from './fields/labeled-field';

interface Props extends Omit<React.ComponentPropsWithoutRef<'div'>, 'id'> {
  // The element's `data-id`. Absent for an element the editor can't
  // address, whose card can't be picked or hovered.
  id?: string;
  header?: React.ReactNode;
  bindings: PanelBinding[];
  onNodeChange?: PanelNodeChange;
}

// The card's fields in order, with the fields of each `meta.group` gathered
// where the group's first field was (#753). `group` is `undefined` for a
// field outside any group.
const segmentByGroup = (bindings: PanelBinding[]) => {
  const segments: { group?: string; bindings: PanelBinding[] }[] = [];
  const byName = new Map<string, PanelBinding[]>();

  for (const binding of bindings) {
    const group = readGroup(binding);

    if (group === undefined) {
      segments.push({ bindings: [binding] });

      continue;
    }

    const members = byName.get(group);

    if (members) {
      members.push(binding);

      continue;
    }

    const created = [binding];

    byName.set(group, created);
    segments.push({ group, bindings: created });
  }

  return segments;
};

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

  // Keyed by `property` and `label`, since two bindings can share a label
  // (#318).
  const renderBinding = (binding: PanelBinding) => (
    <div
      key={`${binding.property}-${binding.label}`}
      className={styles.binding}
    >
      <LabeledField
        binding={binding}
        labelClassName={styles.bindingLabel}
        label={
          <>
            {binding.label}
            <span className={styles.bindingProperty}>({binding.property})</span>
          </>
        }
        description={readDescription(binding)}
      >
        <Field binding={binding} onNodeChange={onNodeChange} />
      </LabeledField>
    </div>
  );

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
        <div className={styles.bindings}>
          {segmentByGroup(bindings).map(segment => {
            const fields = segment.bindings.map(renderBinding);

            return segment.group === undefined ? (
              fields
            ) : (
              <fieldset
                key={`group-${segment.group}`}
                className={styles.fieldGroup}
              >
                <legend className={styles.fieldGroupLegend}>
                  {segment.group}
                </legend>
                {fields}
              </fieldset>
            );
          })}
        </div>
      )}
      {children}
    </div>
  );
};

export default ElementFields;
