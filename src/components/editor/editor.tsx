import { useCallback, useState } from 'react';

import { useDebouncedCallback } from '@jbpark/use-hooks';

import { useError, usePreview } from '~/components/context/states';

import Core, { type Props as CoreProps } from './core';
import { useFormatCode } from './use-format-code';

export interface EditorRenderData {
  value: string;
  onChange: (value: string) => void;
  // The same Prettier formatting the built-in editor uses on Cmd+S, for a
  // custom editor's own format-on-save.
  formatCode: (code: string) => Promise<string>;
}

export interface Props extends Omit<CoreProps, 'value' | 'onSave' | 'onError'> {
  value?: string;
  defaultValue?: string;
  debounce?: number;
  // Replaces the built-in CodeMirror editor. `Live.Editor` still sends the
  // value to the provider, debounced; only the editing surface changes.
  renderEditor?: (data: EditorRenderData) => React.ReactNode;
}

const Editor = ({
  defaultValue,
  value: _value,
  debounce = 1000,
  onChange: _onChange,
  renderEditor,
  fragment,
  prettierOptions,
  ...props
}: Props) => {
  const { code, setCode } = usePreview();
  const { setError } = useError();

  // Controlled, the host owns the document; uncontrolled, the provider does
  // (#341). `draft` shows each keystroke at once, while the provider hears
  // about it after `debounce`.
  const controlled = _value !== undefined;
  const [draft, setDraft] = useState(() => defaultValue ?? code);

  // The last code this editor pushed, and the provider code it has already
  // seen. A provider change that isn't this editor's own push came from
  // somewhere else sharing the provider — an uncontrolled DnD, say — and the
  // draft follows it. Adjusted during render so no frame shows the old one.
  const [pushed, setPushed] = useState<string | null>(null);
  const [seenCode, setSeenCode] = useState(code);

  if (code !== seenCode) {
    setSeenCode(code);

    if (!controlled && code !== pushed) {
      setDraft(code);
    }
  }

  const value = controlled ? _value : draft;

  const pushCode = useCallback(
    (next: string) => {
      setPushed(next);
      setCode(next);
    },
    [setCode],
  );

  const onChange = useCallback(
    (next: string) => {
      if (!controlled) {
        setDraft(next);
      }

      _onChange?.(next);
    },
    [_onChange, controlled],
  );

  // Formatting on save reaches the provider at once, ahead of the debounce.
  const onSave = useCallback(
    (formattedCode: string) => {
      pushCode(formattedCode);
    },
    [pushCode],
  );

  const onError = useCallback(
    (error: string | null) => {
      setError(error);
    },
    [setError],
  );

  const formatCode = useFormatCode({ fragment, prettierOptions });

  // Pushes `value` to the provider `debounce` ms after it stops changing,
  // and at once on mount. A pending push is never dropped: it runs when the
  // editor unmounts, and when focus leaves it — so clicking into another
  // surface right after typing edits a document that includes the typing.
  const push = useDebouncedCallback(
    () => pushCode(value),
    { delay: debounce, flushOnUnmount: true },
    [value],
  );

  // `display: contents` so the wrapper adds a blur listener without adding a
  // box: the editor lays out against this element's parent, as before.
  return (
    <div style={{ display: 'contents' }} onBlur={push.flush}>
      {renderEditor ? (
        renderEditor({ value, onChange, formatCode })
      ) : (
        <Core
          value={value}
          onChange={onChange}
          onSave={onSave}
          onError={onError}
          fragment={fragment}
          prettierOptions={prettierOptions}
          {...props}
        />
      )}
    </div>
  );
};

export default Editor;
