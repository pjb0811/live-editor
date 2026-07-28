import { useEffect } from 'react';

import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { cn } from '~/utils';

export interface Props {
  value?: string;
  placeholder?: string;
  className?: string;
  onChange?: (value: string) => void;
}

const Tiptap = ({
  value = '',
  placeholder = 'Enter text...',
  className,
  onChange,
}: Props) => {
  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder })],
    content: value,
    onBlur: ({ editor: e }) => {
      onChange?.(e.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const current = editor.getHTML();

    if (current !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  return (
    <EditorContent
      editor={editor}
      className={cn(
        `tiptap-editor min-h-20 rounded border border-gray-200 bg-white px-3
        py-2`,
        'prose prose-sm max-w-none text-sm text-gray-800',
        '[&_.tiptap]:outline-none',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:pointer-events-none',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:float-left',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:h-0',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:text-gray-400',
        '[&_.tiptap_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]',
        className,
      )}
    />
  );
};

export default Tiptap;
