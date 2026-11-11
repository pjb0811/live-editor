import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

// `false` on the server and while hydrating, `true` after. The first client
// render then matches the server's, so hydration finds no mismatch (#716).
export const useIsClient = () =>
  useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
