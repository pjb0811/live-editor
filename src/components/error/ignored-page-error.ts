// Benign browser notices that arrive as `error` events on `window`. They
// don't come from the preview and mean nothing went wrong (#714).
const IGNORED_PAGE_ERROR =
  /ResizeObserver loop (completed with undelivered notifications|limit exceeded)/;

export const isIgnoredPageError = (message: string | undefined) =>
  IGNORED_PAGE_ERROR.test(message ?? '');
