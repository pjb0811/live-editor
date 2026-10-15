import { useId } from 'react';

import { FieldIdsContext, LABELABLE_KINDS } from './field-ids';
import { type FieldKindBinding, getFieldKind } from './field-kind';

interface Props {
  // The field's binding, to tell whether its control can take the id.
  binding: FieldKindBinding;
  label: React.ReactNode;
  labelClassName?: string;
  children: React.ReactNode;
}

// A field's `<label>` and the field it names, tied together by id so the
// label names the control and clicking it focuses the control (#637). A
// control that can't take the id gets no `htmlFor`, and names itself as it
// would outside a label. Renders no wrapper, so it fits any layout around it.
const LabeledField = ({ binding, label, labelClassName, children }: Props) => {
  const controlId = useId();
  const isLabelable = LABELABLE_KINDS.has(getFieldKind(binding));

  return (
    <FieldIdsContext.Provider value={isLabelable ? controlId : null}>
      <label
        htmlFor={isLabelable ? controlId : undefined}
        className={labelClassName}
      >
        {label}
      </label>
      {children}
    </FieldIdsContext.Provider>
  );
};

export default LabeledField;
