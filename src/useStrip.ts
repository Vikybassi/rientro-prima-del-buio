import { useEffect, useRef, useState } from 'react';

/**
 * Larghezza di un elemento e carattere del suo testo, aggiornati quando cambia la finestra o arriva il carattere
 * vero: servono per mettere in fila delle etichette senza sovrapporle (labels.ts).
 */
export function useStrip<T extends HTMLElement>(weight = 500) {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, font: '' });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // il `font` calcolato è vuoto quando ci sono varianti (i numeri tabellari): si ricompone a mano
    const measure = () => {
      const cs = getComputedStyle(el);
      setSize({ width: el.clientWidth, font: `${weight} ${cs.fontSize} ${cs.fontFamily}` });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [weight]);
  return { ref, ...size };
}
