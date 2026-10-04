import { useState } from 'react';

import { Card, Tabs, Tooltip } from '@jbpark/ui-kit';
import { Info } from 'lucide-react';

import Context from '~/components/context';
import Dnd, {
  Field,
  type PanelBinding,
  type PanelNodeChange,
  useDndInspector,
  useDndLayout,
  useDndPanel,
} from '~/components/dnd';
import { cn } from '~/utils';

import { META_BINDING_KEYS, META_DOCUMENT, META_EXAMPLE } from './meta-example';

type VisibleRule = {
  property: string;
  id?: string;
  in: unknown[];
  default?: unknown;
};

const isVisibleRule = (value: unknown): value is VisibleRule =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as VisibleRule).property === 'string' &&
  Array.isArray((value as VisibleRule).in);

// The `visible` check from the docs: `false` hides a field, and a rule shows
// it only while another binding's value is in a list. Anything else, a
// malformed rule included, leaves the field visible.
const isVisible = (binding: PanelBinding, bindings: PanelBinding[]) => {
  const rule = binding.meta?.visible;

  if (rule === false) {
    return false;
  }

  if (!isVisibleRule(rule)) {
    return true;
  }

  const source = bindings.find(
    item =>
      item.id === (rule.id ?? binding.id) && item.property === rule.property,
  );
  const value =
    source && source.present !== false ? source.value : rule.default;

  return Array.isArray(value)
    ? value.some(entry => rule.in.includes(entry))
    : rule.in.includes(value);
};

const metaString = (binding: PanelBinding, key: string) => {
  const value = binding.meta?.[key];

  return typeof value === 'string' && value ? value : undefined;
};

const DEFAULT_TAB = 'General';

// Fields arrive in element order, and the section's own fields come first,
// so first appearance would open on Style. The panel fixes the tab order
// instead. A tab it doesn't list goes after these.
const TAB_ORDER = ['Content', 'Style'];

const tabRank = (name: string) => {
  const index = TAB_ORDER.indexOf(name);

  return index === -1 ? TAB_ORDER.length : index;
};

// Groups in first-appearance order, which is the section's element order.
const groupBy = <T,>(entries: T[], keyOf: (entry: T) => string) => {
  const groups = new Map<string, T[]>();

  for (const entry of entries) {
    const key = keyOf(entry);
    const group = groups.get(key);

    if (group) {
      group.push(entry);
    } else {
      groups.set(key, [entry]);
    }
  }

  return [...groups];
};

// A field with no `group` is grouped by its element, as in the built-in
// panel. Prefixed so a `group` name can never match an element id.
const boxKey = (binding: PanelBinding) => {
  const group = metaString(binding, 'group');

  return group ? `group:${group}` : `element:${binding.id}`;
};

const boxTitle = (binding: PanelBinding) => {
  const group = metaString(binding, 'group');

  if (group) {
    return group;
  }

  const { tagName = 'element', text = '' } = binding.element ?? {};

  return text ? `${tagName} · ${text}` : tagName;
};

const MetaField = ({
  binding,
  onNodeChange,
}: {
  binding: PanelBinding;
  onNodeChange: PanelNodeChange;
}) => {
  const description = metaString(binding, 'description');
  const hint = metaString(binding, 'hint');

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <span className="text-xs font-medium text-gray-700">
          {binding.label}
        </span>
        {/* A hint is extra detail the user opens on demand, so it sits
            behind an icon. Anything they need to read is a description.
            The trigger is a button so keyboard focus opens it too. */}
        {hint && (
          <Tooltip content={hint} placement="top">
            <button
              type="button"
              aria-label={hint}
              className="inline-flex cursor-help border-0 bg-transparent p-0
                text-gray-400"
            >
              <Info size={12} />
            </button>
          </Tooltip>
        )}
      </div>
      <Field binding={binding} onNodeChange={onNodeChange} />
      {description && <p className="text-xs text-gray-500">{description}</p>}
    </div>
  );
};

// A panel that reads the common `meta` keys: fields go on a tab by `tab`,
// into a box by `group` (or by element when they have none), carry their
// `description` and `hint`, and drop out while `visible` says so. Each field
// is still the built-in control (`Field`), so only the arrangement is new.
const MetaPanel = () => {
  const { item, bindings, onNodeChange } = useDndPanel();
  const { highlight } = useDndInspector();
  const [selectedTab, setSelectedTab] = useState<string>();

  if (!item) {
    return (
      <p className="p-4 text-sm text-gray-500">
        Select a section on the canvas.
      </p>
    );
  }

  // Visibility depends on other bindings' values, so it runs on every
  // render, after an edit as much as on a new selection.
  const shown = bindings.filter(binding => isVisible(binding, bindings));
  const tabs = groupBy(
    shown,
    binding => metaString(binding, 'tab') ?? DEFAULT_TAB,
  ).sort(([a], [b]) => tabRank(a) - tabRank(b));
  // A tab another section had, or one a `visible` rule just emptied, falls
  // back to the first.
  const tabName = tabs.some(([name]) => name === selectedTab)
    ? selectedTab
    : tabs[0]?.[0];

  // One box per `group`, or per element for fields without one.
  const renderBoxes = (tabBindings: PanelBinding[]) => (
    <div className="space-y-3">
      {groupBy(tabBindings, boxKey).map(([key, fields]) => {
        const title = boxTitle(fields[0]!);

        return (
          <Card
            key={key}
            role="group"
            aria-label={title}
            title={title}
            classNames={{
              title: 'text-xs font-normal text-gray-500',
              body: 'space-y-3',
            }}
            // A group can span elements, so a box outlines the element of
            // the field under the pointer rather than the box's own.
            onPointerLeave={() => highlight(null)}
          >
            {fields.map(binding => (
              <div
                key={`${binding.id}-${binding.property}`}
                onPointerEnter={() => highlight(binding.id)}
              >
                <MetaField binding={binding} onNodeChange={onNodeChange} />
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-gray-200 px-4 py-3 font-semibold">
        {item.name}
      </div>
      {tabs.length === 0 && (
        <p className="p-4 text-xs text-gray-400">No editable elements.</p>
      )}
      {tabs.length === 1 && (
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {renderBoxes(tabs[0]![1])}
        </div>
      )}
      {tabs.length > 1 && (
        <Tabs
          value={tabName}
          onChange={value => setSelectedTab(String(value))}
          listLabel="Field tabs"
          items={tabs.map(([name, tabBindings]) => ({
            key: name,
            label: name,
            children: renderBoxes(tabBindings),
          }))}
          className="min-h-0 flex-1"
          classNames={{
            list: 'px-2',
            panel: 'min-h-0 flex-1 overflow-y-auto p-4',
          }}
        />
      )}
    </div>
  );
};

// The canvas and the panel side by side, or stacked on a phone. There's no
// palette: the demo is about the one section already on the canvas.
const MetaLayout = () => {
  const { isMobile } = useDndLayout();

  return (
    <div className={cn('flex h-full min-h-0 w-full', isMobile && 'flex-col')}>
      <Dnd.Canvas className="min-h-0 min-w-0 flex-1" />
      <div
        className={cn(
          'shrink-0 border-gray-200',
          isMobile ? 'h-1/2 border-t' : 'w-80 border-l',
        )}
      >
        <MetaPanel />
      </div>
    </div>
  );
};

// Panel `meta` demo. `value`/`onChange` are optional: the docs embed keeps
// the document to itself, while the dev app's page passes its own so it can
// show the same document as code.
const PanelMetaDemo = ({
  value: controlledValue,
  onChange,
}: {
  value?: string;
  onChange?: (value: string) => void;
}) => {
  const [ownValue, setOwnValue] = useState(META_DOCUMENT);
  const value = controlledValue ?? ownValue;
  const setValue = onChange ?? setOwnValue;

  return (
    <Context>
      <Dnd
        value={value}
        onChange={setValue}
        items={[META_EXAMPLE]}
        bindingKeys={META_BINDING_KEYS}
        frame={{ mode: 'shadow', syncStyle: true }}
        dynamicTailwind
        className="h-full"
      >
        <MetaLayout />
      </Dnd>
    </Context>
  );
};

export default PanelMetaDemo;
