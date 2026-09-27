/** M1 stand-in: M1.5 moves brand selection into resolveScene (decision P10). */
const BRANDS = ["Kettle & Co.", "Northbound", "Maison Loaf"] as const;

export function brandFor(seed: number): string {
  return BRANDS[(seed >>> 0) % BRANDS.length]!;
}

export function fillBrand(text: string, brand: string): string {
  return text.replaceAll("{brand}", brand);
}
