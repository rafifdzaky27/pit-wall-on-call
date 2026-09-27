import { mulberry32, streamSeed } from "@pitwall/engine";
import { CITIES, type Brand, type City, type ColleagueRole, type CurrencyCode } from "./cities";

export * from "./cities";

export interface World {
  city: City;
  brand: Brand;
  colleagues: Record<ColleagueRole, string>;
}

/** The daily's seed decides the city, so everyone playing that day shares it (spec D19). */
export function resolveWorld(seed: number): World {
  const rng = mulberry32(streamSeed(seed, "world"));
  const city = CITIES[rng.int(CITIES.length)]!;
  return { city, brand: city.brand, colleagues: city.colleagues };
}

const group = (n: number, sep: string) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

export function formatPrice(minor: number, currency: CurrencyCode): string {
  if (currency === "IDR") return `Rp${group(minor, ".")}`;
  if (currency === "JPY") return `¥${group(minor, ",")}`;
  return `$${group(Math.floor(minor / 100), ",")}.${String(minor % 100).padStart(2, "0")}`;
}

const TOKENS: Record<string, (w: World) => string> = {
  brand: (w) => w.brand.name,
  deployer: (w) => w.colleagues.deployer,
  secondary: (w) => w.colleagues.secondary,
  infra: (w) => w.colleagues.infra,
  support: (w) => w.colleagues.support,
};

export function fillWorld(text: string, world: World): string {
  return text.replace(/\{(\w+)\}/g, (match, token: string) => (Object.hasOwn(TOKENS, token) ? TOKENS[token]!(world) : match));
}
