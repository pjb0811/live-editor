import { useEffect, useId, useRef } from 'react';

import { X } from 'lucide-react';

import styles from './drawer.module.css';

import Button from './button';

interface Props {
  open: boolean;
  title: React.ReactNode;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
}

// A sheet that slides up from the bottom of the viewport, in a modal
// `<dialog>`: focus moves into it and stays there, the page behind is
// inert, and Escape or a click on the backdrop closes it. Its children
// mount only while it is open.
const Drawer = ({ open, title, closeLabel, onClose, children }: Props) => {
  const titleId = useId();

  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog || !open) {
      return;
    }

    // jsdom has no `showModal`.
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }

    return () => {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.drawer}
      aria-labelledby={titleId}
      // Escape fires `cancel`; the dialog stays open until `open` changes.
      onCancel={e => {
        e.preventDefault();
        onClose();
      }}
      // A click on the dialog itself, not on its content, is on the
      // backdrop.
      onClick={e => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <Button
            variant="text"
            size="small"
            icon={<X />}
            aria-label={closeLabel}
            onClick={onClose}
          />
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  );
};

export default Drawer;
