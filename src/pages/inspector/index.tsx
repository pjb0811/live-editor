import { useCallback, useState } from 'react';

import { Button, Modal, Switch, Tag } from '@jbpark/ui-kit';
import { Crosshair, Trash2 } from 'lucide-react';

import {
  type DndEditError,
  type DndNodePick,
  type DndRenderField,
  getFieldKind,
  useDndInspector,
} from '~/components/dnd';
import { toastEditError } from '~/components/dnd/edit-options';
import { DEFAULT_CONTAINER_ID, DRAGGABLE_ITEMS } from '~/constants';
import Live from '~/index';
import type { Section } from '~/types';

import { documentWith } from '../shared/documents';
import { IFRAME_FRAME } from '../shared/frames';
import { REGISTRY, REGISTRY_EXAMPLE } from '../shared/registry-example';
import { SECTION_ROOT_EXAMPLE } from '../shared/section-root-example';

const PALETTE = [...DRAGGABLE_ITEMS, SECTION_ROOT_EXAMPLE, REGISTRY_EXAMPLE];

const INITIAL_DOCUMENT = documentWith([
  DRAGGABLE_ITEMS[0],
  SECTION_ROOT_EXAMPLE,
  REGISTRY_EXAMPLE,
]);

// The same document with its container id renamed. `Live.Dnd` finds no
// sections in it and reports `container-not-found` through `onEditError`.
const WITHOUT_CONTAINER = INITIAL_DOCUMENT.replace(
  `id="${DEFAULT_CONTAINER_ID}"`,
  'id="renamed-container"',
);

interface LogEntry {
  id: number;
  kind: 'pick' | 'error' | 'delete';
  text: string;
}

interface Options {
  useRegistry: boolean;
  annotateFields: boolean;
  logErrors: boolean;
  confirmDelete: boolean;
}

// Under `Live.Dnd`, so it can reach the element picker.
const Toolbar = ({
  options,
  onOptionsChange,
  onLoad,
}: {
  options: Options;
  onOptionsChange: (options: Options) => void;
  onLoad: (document: string) => void;
}) => {
  const inspector = useDndInspector();
  const toggle = (key: keyof Options, label: string) => (
    <label className="flex items-center gap-1.5 text-xs">
      <Switch
        size="small"
        checked={options[key]}
        onChange={checked => onOptionsChange({ ...options, [key]: checked })}
      />
      {label}
    </label>
  );

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b
        border-gray-200 px-3 py-1.5"
    >
      <Button
        size="small"
        type={inspector.active ? 'primary' : 'default'}
        icon={<Crosshair size={14} />}
        onClick={inspector.toggle}
      >
        {inspector.active ? 'Picking…' : 'Pick element'}
      </Button>
      <span className="text-xs text-gray-500">
        Picked:{' '}
        {inspector.picked ? (
          <code>
            {inspector.picked.sectionId} / {inspector.picked.id}
          </code>
        ) : (
          'none'
        )}
      </span>
      <Button size="small" onClick={() => onLoad(WITHOUT_CONTAINER)}>
        Remove container
      </Button>
      <Button size="small" onClick={() => onLoad(INITIAL_DOCUMENT)}>
        Reset document
      </Button>
      <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
        {toggle('useRegistry', 'bindings: registry')}
        {toggle('annotateFields', 'renderField: annotate')}
        {toggle('logErrors', 'onEditError: log instead of toast')}
        {toggle('confirmDelete', 'onBeforeDelete: confirm')}
      </div>
    </div>
  );
};

const LOG_COLOR = {
  pick: 'primary',
  error: 'danger',
  delete: 'warning',
} as const;

const EventLog = ({
  entries,
  onClear,
}: {
  entries: LogEntry[];
  onClear: () => void;
}) => (
  <div className="flex h-36 shrink-0 flex-col border-t border-gray-200">
    <div className="flex items-center justify-between px-3 py-1">
      <span className="text-xs font-medium">Events</span>
      <Button
        size="small"
        type="text"
        aria-label="Clear events"
        icon={<Trash2 size={14} />}
        disabled={entries.length === 0}
        onClick={onClear}
      />
    </div>
    <ul
      className="m-0 min-h-0 flex-1 list-none overflow-y-auto px-3 pb-2 text-xs"
    >
      {entries.length === 0 ? (
        <li className="text-gray-500">
          Pick an element, delete a section, or remove the container.
        </li>
      ) : (
        entries.map(entry => (
          <li key={entry.id} className="flex items-center gap-2 py-0.5">
            <Tag color={LOG_COLOR[entry.kind]}>{entry.kind}</Tag>
            <span className="font-mono">{entry.text}</span>
          </li>
        ))
      )}
    </ul>
  </div>
);

// Wraps each built-in control with the binding's property and the control
// kind the library picked for it.
const annotate: DndRenderField = ({ binding }, builtin) => (
  <div>
    {builtin}
    <div className="mt-0.5 text-[10px] text-gray-400">
      {binding.property} · {getFieldKind(binding)}
    </div>
  </div>
);

const confirmDelete = (section: Section) =>
  new Promise<boolean>(resolve => {
    Modal.confirm({
      title: 'Delete section?',
      content: `"${section.name}" will be removed from the document.`,
      okText: 'Delete',
      cancelText: 'Cancel',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });

// The hooks a host passes to `Live.Dnd` besides its value: the element
// picker (`onNodePick`, `useDndInspector`), field rendering (`renderField`),
// error reporting (`onEditError`) and the delete guard (`onBeforeDelete`).
const Inspector = () => {
  const [value, setValue] = useState(INITIAL_DOCUMENT);
  const [options, setOptions] = useState<Options>({
    useRegistry: true,
    annotateFields: true,
    logErrors: true,
    confirmDelete: true,
  });
  const [log, setLog] = useState<LogEntry[]>([]);

  const append = useCallback((kind: LogEntry['kind'], text: string) => {
    setLog(entries =>
      [{ id: Date.now() + Math.random(), kind, text }, ...entries].slice(0, 50),
    );
  }, []);

  const onNodePick = useCallback(
    ({ id, sectionId }: DndNodePick) => append('pick', `${sectionId} / ${id}`),
    [append],
  );

  const onEditError = (error: DndEditError) => {
    if (!options.logErrors) {
      toastEditError(error);

      return;
    }

    const detail =
      error.type === 'update' && error.failure
        ? ` (${error.failure.reason})`
        : '';

    append('error', `${error.type}: ${error.title}${detail}`);
  };

  const onBeforeDelete = async (section: Section) => {
    const confirmed = options.confirmDelete
      ? await confirmDelete(section)
      : true;

    append('delete', `${section.name}: ${confirmed ? 'deleted' : 'kept'}`);

    return confirmed;
  };

  return (
    <Live>
      <Live.Dnd
        frame={IFRAME_FRAME}
        items={PALETTE}
        value={value}
        onChange={setValue}
        onNodePick={onNodePick}
        bindings={options.useRegistry ? REGISTRY : undefined}
        renderField={options.annotateFields ? annotate : undefined}
        onEditError={onEditError}
        onBeforeDelete={onBeforeDelete}
        className="flex h-full flex-col"
      >
        <Toolbar
          options={options}
          onOptionsChange={setOptions}
          onLoad={setValue}
        />
        <div className="min-h-0 flex-1">
          <Live.Dnd.Layout />
        </div>
        <EventLog entries={log} onClear={() => setLog([])} />
      </Live.Dnd>
    </Live>
  );
};

export default Inspector;
