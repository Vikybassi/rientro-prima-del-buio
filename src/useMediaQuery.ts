import { useSyncExternalStore } from 'react';

/** true finché la media query è soddisfatta (es. schermo largo), e si aggiorna se la finestra cambia. */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
  );
}
