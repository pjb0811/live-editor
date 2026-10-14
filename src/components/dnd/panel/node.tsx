import type { DataAttrNode } from '~/utils/ast/types';

import {
  type PanelNodeChange,
  resolvePanelBindings,
  withPanelCommit,
} from '../panel-binding';
import Field from './field';
import LabeledField from './labeled-field';

interface FieldEditorProps {
  data: DataAttrNode;
  onChange?: PanelNodeChange;
}

const Node = ({ data, onChange }: FieldEditorProps) => {
  const source = resolvePanelBindings(data);

  if (!source) {
    return null;
  }

  // Keyed by `property`, not `label`, which two bindings can share (#318).
  return (
    <div className="space-y-2 rounded">
      <div className="space-y-1">
        {withPanelCommit(source.bindings, onChange).map(binding => (
          <div key={`${binding.id}-${binding.property}`} className="space-y-1">
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
              <Field binding={binding} onNodeChange={onChange} />
            </LabeledField>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Node;
