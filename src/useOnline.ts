import { useSyncExternalStore } from 'react';

/** true se il browser pensa di avere la rete; si aggiorna quando la connessione va e viene. */
export function useOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    },
    () => navigator.onLine,
  );
}
