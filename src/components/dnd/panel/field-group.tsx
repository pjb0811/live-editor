import type { PanelBinding } from '../dnd';
import Field from './field';

interface Props {
  bindings: PanelBinding[];
  onNodeChange?: (params: {
    id: string;
    label: string;
    property: string;
    value: unknown;
  }) => void;
}

// One bordered group per element `id` — the same visual grouping `Node`
// (panel/node.tsx) renders, but for the top-level panel list, where
// `bindings` are already resolved PanelBindings (see dnd.tsx's `bindings`
// useMemo). `Node` stays a separate component: it still parses a raw
// DataAttrNode itself, which `Items` needs for elements it discovers
// dynamically inside an array item's `children` (not present in the
// top-level `bindings` array at all) — see #237's items/children boundary.
const FieldGroup = ({ bindings, onNodeChange }: Props) => (
  <div className="space-y-2 rounded">
    <div className="space-y-1">
      {bindings.map(binding => (
        <div key={binding.label} className="space-y-1">
          <label className="block text-xs font-semibold text-gray-700">
            {binding.label}
            <span className="ml-1 text-gray-400">({binding.property})</span>
          </label>
          <Field binding={binding} onNodeChange={onNodeChange} />
        </div>
      ))}
    </div>
  </div>
);

export default FieldGroup;
