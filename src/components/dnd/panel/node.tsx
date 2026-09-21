import type { DataAttrNode } from '~/utils/ast';

import {
  type PanelNodeChange,
  resolvePanelBindings,
  withPanelCommit,
} from '../panel-binding';
import Field from './field';

export interface FieldEditorProps {
  data: DataAttrNode;
  onChange?: PanelNodeChange;
}

const Node = ({ data, onChange }: FieldEditorProps) => {
  const source = resolvePanelBindings(data);

  if (!source) {
    return null;
  }

  // Keyed by `property`, never `label`: two bindings on one element may
  // share a label, and using it as identity is what #318 fixed elsewhere.
  return (
    <div className="space-y-2 rounded">
      <div className="space-y-1">
        {withPanelCommit(source.bindings, onChange).map(binding => (
          <div key={`${binding.id}-${binding.property}`} className="space-y-1">
            <label className="block text-xs font-semibold text-gray-700">
              {binding.label}
              <span className="ml-1 text-gray-400">({binding.property})</span>
            </label>
            <Field binding={binding} onNodeChange={onChange} />
          </div>
        ))}
      </div>
    </div>
  );
};

export default Node;
