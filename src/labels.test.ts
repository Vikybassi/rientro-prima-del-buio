import { describe, expect, it } from 'vitest';
import { layoutLabels } from './labels.ts';

describe('layoutLabels', () => {
  it('etichette lontane stanno sulla stessa riga, centrate sul loro punto', () => {
    const out = layoutLabels([{ key: 'a', x: 100, width: 60 }, { key: 'b', x: 300, width: 60 }], 400);
    expect(out).toEqual([{ key: 'a', left: 70, row: 0 }, { key: 'b', left: 270, row: 0 }]);
  });

  it('se due si toccano la seconda scende di una riga (il caso del telefono: parti 16:00 e rientro 20:30)', () => {
    const out = layoutLabels([{ key: 'start', x: 220, width: 80 }, { key: 'back', x: 290, width: 130 }], 350);
    expect(out.find((l) => l.key === 'start')!.row).toBe(0);
    expect(out.find((l) => l.key === 'back')!.row).toBe(1);
  });

  it('una terza etichetta torna sulla prima riga se lì c\'è posto', () => {
    const out = layoutLabels(
      [{ key: 'a', x: 40, width: 70 }, { key: 'b', x: 90, width: 70 }, { key: 'c', x: 300, width: 70 }],
      400,
    );
    expect(out.map((l) => l.row)).toEqual([0, 1, 0]);
  });

  it('non esce dai bordi della striscia', () => {
    const out = layoutLabels([{ key: 'a', x: 5, width: 80 }, { key: 'b', x: 398, width: 80 }], 400);
    expect(out[0].left).toBe(0);
    expect(out[1].left).toBe(320);
  });
});
