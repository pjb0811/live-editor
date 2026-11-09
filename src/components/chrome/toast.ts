import styles from './toast.module.css';

const TOAST_DURATION = 6000;

let region: HTMLElement | null = null;

// The fixed stack the toasts go in, made on first use. Plain DOM rather
// than React, so a toast can show from anywhere, inside `Live.Dnd` or not.
const getRegion = () => {
  if (region?.isConnected) {
    return region;
  }

  region = document.createElement('div');
  region.className = styles.region!;
  document.body.append(region);

  return region;
};

// Shows an error with an optional description for a few seconds, announced
// to screen readers. A click dismisses it early.
export const showErrorToast = (title: string, description?: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  const toast = document.createElement('div');

  toast.className = styles.toast!;
  toast.setAttribute('role', 'alert');

  const heading = document.createElement('div');

  heading.className = styles.title!;
  heading.textContent = title;
  toast.append(heading);

  if (description) {
    const detail = document.createElement('div');

    detail.className = styles.description!;
    detail.textContent = description;
    toast.append(detail);
  }

  const remove = () => {
    window.clearTimeout(timer);
    toast.remove();
  };
  const timer = window.setTimeout(remove, TOAST_DURATION);

  toast.addEventListener('click', remove);
  getRegion().append(toast);
};
