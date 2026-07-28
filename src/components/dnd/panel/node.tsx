import { type DataAttrNode, getCurrentValue, parseBinding } from '~/utils/ast';

import Field from './field';

interface Props {
  data: DataAttrNode;
  onChange?: (params: { id: string; label: string; value: string }) => void;
}

const Node = ({ data, onChange }: Props) => {
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

          return (
            <div key={binding.label} className="space-y-1">
              <label className="block text-xs font-semibold text-gray-700">
                {binding.label}
                <span className="ml-1 text-gray-400">({binding.property})</span>
              </label>
              <Field
                id={dataId}
                binding={binding}
                value={currentValue}
                onChange={onChange}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Node;
