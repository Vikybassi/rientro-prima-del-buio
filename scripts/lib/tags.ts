/** Lettura dei tag OSM, che sono sempre stringhe scritte a mano da persone diverse. */

export function num(s: string | undefined): number | undefined {
  if (!s) return undefined;
  const n = Number.parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : undefined;
}

/** I tempi CAI su OSM sono scritti in modi diversi ("02:30", "2:30", "2.50"): li leggiamo tutti come ore:minuti. */
export function minutes(s: string | undefined): number | undefined {
  const m = s?.trim().match(/^(\d+)[:.](\d{2})$/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : undefined;
}
