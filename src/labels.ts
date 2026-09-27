/**
 * Etichette in fila su una striscia (la barra della giornata): ognuna vuole stare centrata sul suo punto, ma se
 * due si toccano la seconda scende di una riga. Si ragiona in pixel veri, non in percentuali: sul telefono il 20%
 * della barra sono 70 px, meno di un'etichetta.
 */
export type LabelIn = { key: string; x: number; width: number };
export type LabelOut = { key: string; left: number; row: number };

/** Spazio minimo tra due etichette sulla stessa riga, in px. */
const GAP = 10;

export function layoutLabels(labels: LabelIn[], total: number): LabelOut[] {
  const rowsEnd: number[] = []; // per ogni riga, dove finisce l'ultima etichetta messa
  return [...labels]
    .sort((a, b) => a.x - b.x)
    .map(({ key, x, width }) => {
      // centrata sul punto, ma dentro la striscia
      const left = Math.max(0, Math.min(total - width, x - width / 2));
      let row = rowsEnd.findIndex((end) => left >= end + GAP);
      if (row === -1) row = rowsEnd.length;
      rowsEnd[row] = left + width;
      return { key, left, row };
    });
}

let canvas: HTMLCanvasElement | null = null;

/** Larghezza di un testo nel carattere dato (es. "500 12.5px Geist"), misurata davvero. */
export function textWidth(text: string, font: string): number {
  canvas ??= document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return text.length * 7.5;
  ctx.font = font;
  return Math.ceil(ctx.measureText(text).width);
}
