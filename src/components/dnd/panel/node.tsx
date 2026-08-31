import {
  type DataAttrNode,
  getCurrentValue,
  getStructuredValue,
  parseBinding,
} from '~/utils/ast';

import Field from './field';

export interface FieldEditorProps {
  data: DataAttrNode;
  onChange?: (params: {
    id: string;
    label: string;
    property: string;
    value: unknown;
  }) => void;
}

const Node = ({ data, onChange }: FieldEditorProps) => {
  const idAttr = data.dataAttributes.find(a => a.name === 'data-id');
  const bindingAttr = data.dataAttributes.find(a => a.name === 'data-binding');

  if (!idAttr?.value || !bindingAttr?.value) {
    return null;
  }

  const dataId = idAttr.value;
  const bindings = data.bindings || parseBinding(bindingAttr.value);

  if (!bindings.length) {
    return null;
  }

  return (
    <div className="space-y-2 rounded">
      <div className="space-y-1">
        {bindings.map(binding => {
          const currentValue = getCurrentValue(data, binding.property);
          const structuredValue = getStructuredValue(
            data,
            binding.property,
            binding.type,
          );

          return (
            <div key={binding.label} className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700">
                {binding.label}
                <span className="ml-1 text-gray-400">({binding.property})</span>
              </label>
              <Field
                binding={{
                  id: dataId,
                  label: binding.label,
                  property: binding.property,
                  type: binding.type,
                  widget: binding.widget,
                  options: binding.options,
                  render: binding.render,
                  min: binding.min,
                  max: binding.max,
                  pattern: binding.pattern,
                  required: binding.required,
                  meta: binding.meta,
                  value: structuredValue,
                  rawValue: currentValue,
                  onChange: next =>
                    onChange?.({
                      id: dataId,
                      label: binding.label,
                      property: binding.property,
                      value: next,
                    }),
                }}
                onNodeChange={onChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Node;
