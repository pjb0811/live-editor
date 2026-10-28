// `mb-0` matters: `dist/style.css` has no CSS reset, so without it a `<p>`
// keeps the browser's bottom margin and the fields below jump when the
// error appears (#409).
// `role="alert"` announces the message when it appears; the control points
// at it with `aria-describedby` so it's read again on focus (#637).
const FieldError = ({ id, message }: { id: string; message: string | null }) =>
  message ? (
    <p id={id} role="alert" className="mt-1 mb-0 text-xs text-red-500">
      {message}
    </p>
  ) : null;

export default FieldError;
