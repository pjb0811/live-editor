import { type ChangeEvent, useEffect, useRef, useState } from 'react';

import { useLatest } from '@jbpark/use-hooks';
import { ImageUp } from 'lucide-react';

import Button from '~/components/chrome/button';
import { useLiveMessages } from '~/components/context/messages';

import styles from './fields.module.css';

import { useDndEditOptions } from '../../edit-options';
import type { PanelBinding } from '../../panel-binding';
import FieldError from './field-error';
import type { useFieldState } from './use-field-state';

interface ImageFieldProps {
  binding: PanelBinding;
  // The state `BuiltinField` already holds for this binding.
  state: ReturnType<typeof useFieldState>;
}

// `type: 'image'` (#752): a URL input that commits on blur, a thumbnail of
// the committed value, and a file picker when `Live.Dnd` has `onUpload`.
const ImageField = ({ binding, state }: ImageFieldProps) => {
  const messages = useLiveMessages();
  const { onUpload, reportError } = useDndEditOptions();
  const { text, setText, validationError, errorId, controlProps } = state;

  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Which upload is the latest, and whether the field is still mounted: a
  // result for anything else is dropped.
  const uploadRef = useRef(0);
  const mountedRef = useRef(true);

  // The field as of the latest render, so a result commits through the
  // current `onChange` and only while the binding is the same one.
  const latestRef = useLatest({
    target: `${binding.id}\u0000${binding.property}`,
    setText,
    validateAndCommit: state.validateAndCommit,
  });

  // The committed value, not the text being typed, so a half-typed URL isn't
  // requested.
  const src = binding.rawValue;
  const showsThumbnail = src !== '' && failedSrc !== src;

  const upload = async (file: File) => {
    if (!onUpload) {
      return;
    }

    const generation = ++uploadRef.current;
    const target = latestRef.current.target;
    const { id, label, property, type } = binding;
    const isCurrent = () =>
      mountedRef.current &&
      generation === uploadRef.current &&
      latestRef.current.target === target;

    setIsUploading(true);

    try {
      const url = await onUpload(file, {
        binding: { id, label, property, type },
      });

      if (!isCurrent()) {
        return;
      }

      latestRef.current.setText(url);
      latestRef.current.validateAndCommit(url);
    } catch (error) {
      if (!isCurrent()) {
        return;
      }

      reportError({
        type: 'upload',
        id,
        label,
        property,
        error,
        title: messages.editErrors.uploadFailed(label),
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      if (mountedRef.current && generation === uploadRef.current) {
        setIsUploading(false);
      }
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    // Cleared, so choosing the same file again fires `change` again.
    event.target.value = '';

    if (file) {
      void upload(file);
    }
  };

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return (
    <div className={styles.stack}>
      {showsThumbnail && (
        <img
          src={src}
          alt=""
          className={styles.imagePreview}
          onError={() => setFailedSrc(src)}
        />
      )}
      <input
        {...controlProps}
        // Text, not `url`: a relative path is a valid image source.
        type="text"
        inputMode="url"
        value={text}
        className={styles.control}
        onChange={e => setText(e.target.value)}
        placeholder={messages.panel.imagePlaceholder}
        onBlur={e => state.validateAndCommit(e.target.value.trim())}
      />
      {onUpload && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            tabIndex={-1}
            onChange={onFileChange}
          />
          <Button
            size="small"
            icon={<ImageUp />}
            disabled={isUploading}
            aria-busy={isUploading || undefined}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading
              ? messages.panel.uploadingImage
              : messages.panel.chooseImage}
          </Button>
        </>
      )}
      <FieldError id={errorId} message={validationError} />
    </div>
  );
};

export default ImageField;
