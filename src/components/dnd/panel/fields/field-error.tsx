import styles from './fields.module.css';

// `role="alert"` announces the message when it appears; the control points
// at it with `aria-describedby` so it's read again on focus (#637).
const FieldError = ({ id, message }: { id: string; message: string | null }) =>
  message ? (
    <p id={id} role="alert" className={styles.error}>
      {message}
    </p>
  ) : null;

export default FieldError;
