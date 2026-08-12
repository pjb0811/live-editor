import { javascript } from '@codemirror/lang-javascript';
import { unifiedMergeView } from '@codemirror/merge';
import { Modal } from '@jbpark/ui-kit';
import { vscodeLight } from '@uiw/codemirror-theme-vscode';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView } from 'codemirror';

interface Props {
  open: boolean;
  original: string;
  current: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Read-only review step before persisting to localStorage — shows what
// changed since the last save (unifiedMergeView diffs the editor's own
// content against `original`), so the user can confirm the AST-transform
// pipeline did what they expected before it's saved. Not an editing tool:
// mergeControls/editable are both off, this is display-only.
const DiffModal = ({ open, original, current, onConfirm, onCancel }: Props) => {
  return (
    <Modal
      open={open}
      title="Review changes before saving"
      okText="Save"
      cancelText="Cancel"
      onOk={onConfirm}
      onCancel={onCancel}
      style={{ width: 800, maxWidth: '90vw' }}
    >
      <div className="max-h-[60vh] overflow-auto rounded border border-gray-200">
        <CodeMirror
          value={current}
          theme={vscodeLight}
          editable={false}
          readOnly
          extensions={[
            javascript({ jsx: true, typescript: true }),
            EditorView.lineWrapping,
            unifiedMergeView({ original, mergeControls: false }),
          ]}
        />
      </div>
    </Modal>
  );
};

export default DiffModal;
