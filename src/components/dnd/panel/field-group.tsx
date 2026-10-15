import type { PanelBinding, PanelNodeChange } from '../panel-binding';
import Field from './field';
import LabeledField from './labeled-field';

interface Props {
  bindings: PanelBinding[];
  onNodeChange?: PanelNodeChange;
}

// The fields of one element, from `PanelBinding`s. `Node` draws the same
// for an extracted node, as the Children editor has.
const FieldGroup = ({ bindings, onNodeChange }: Props) => (
  <div className="space-y-2 rounded">
    <div className="space-y-1">
      {bindings.map(binding => (
        <div key={`${binding.property}-${binding.label}`} className="space-y-1">
          <LabeledField
            binding={binding}
            labelClassName="block text-xs font-semibold text-gray-700"
            label={
              <>
                {binding.label}
                <span className="ml-1 text-gray-400">({binding.property})</span>
              </>
            }
          >
            <Field binding={binding} onNodeChange={onNodeChange} />
          </LabeledField>
        </div>
      ))}
    </div>
  </div>
);

export default FieldGroup;
