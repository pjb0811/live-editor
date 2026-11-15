import { useId } from 'react';

import styles from './fields.module.css';

import { FieldIdsContext, LABELABLE_KINDS } from './field-ids';
import { type FieldKindBinding, getFieldKind } from './field-kind';

interface Props {
  // The field's binding, to tell whether the built-in control takes the id.
  binding: FieldKindBinding;
  label: React.ReactNode;
  labelClassName?: string;
  // From `panelLayout.describe`: shown under the label, and named by the
  // control as its description (#753, #763).
  description?: React.ReactNode;
  children: React.ReactNode;
}

// A field's `<label>` and the field it names, tied together by id so the
// label names the control and clicking it focuses the control (#637). The
// label points at a built-in control with `htmlFor`, and carries an id of
// its own for a control that points back with `aria-labelledby`, such as
// one from `renderField`. Renders no wrapper, so it fits any layout around
// it.
const LabeledField = ({
  binding,
  label,
  labelClassName,
  description,
  children,
}: Props) => {
  const controlId = useId();
  const labelId = `${controlId}-label`;
  const hasDescription =
    description !== undefined &&
    description !== null &&
    description !== false &&
    description !== '';
  const descriptionId = hasDescription ? `${controlId}-description` : undefined;
  const isLabelable = LABELABLE_KINDS.has(getFieldKind(binding));

  return (
    <FieldIdsContext.Provider value={{ controlId, labelId, descriptionId }}>
      <label
        id={labelId}
        htmlFor={isLabelable ? controlId : undefined}
        className={labelClassName}
      >
        {label}
      </label>
      {hasDescription && (
        <div id={descriptionId} className={styles.description}>
          {description}
        </div>
      )}
      {children}
    </FieldIdsContext.Provider>
  );
};

export default LabeledField;
