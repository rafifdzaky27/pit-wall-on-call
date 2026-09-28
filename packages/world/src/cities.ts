export type CityId = "jakarta" | "yogyakarta" | "tokyo" | "melbourne";
export type CurrencyCode = "IDR" | "JPY" | "AUD";
export type ColleagueRole = "deployer" | "secondary" | "infra" | "support";

export interface Product {
  id: string;
  name: string;
  /** Minor units: rupiah, yen, or Australian cents. */
  price: number;
  blurb: string;
}

export interface Brand {
  name: string;
  domain: string;
  tagline: string;
  kind: string;
  colors: { primary: string; paper: string; ink: string };
  products: Product[];
}

export interface City {
  id: CityId;
  name: string;
  country: string;
  timeZone: string;
  currency: CurrencyCode;
  brand: Brand;
  colleagues: Record<ColleagueRole, string>;
}

// Every brand here is fictional (spec D19). Names and domains are checked against real
// companies in their market before a release; see the M1.5 plan, Task 2.
export const CITIES: readonly City[] = [
  {
    id: "jakarta",
    name: "Jakarta",
    country: "Indonesia",
    timeZone: "Asia/Jakarta",
    currency: "IDR",
    brand: {
      name: "Tokoriya",
      domain: "tokoriya.co.id",
      tagline: "Belanja hari ini, sampai hari ini.",
      kind: "Marketplace",
      colors: { primary: "#d2452f", paper: "#fff8f2", ink: "#2b1b16" },
      products: [
        { id: "kopi", name: "Kopi Susu Gula Aren 1L", price: 89000, blurb: "Siap minum, simpan dingin" },
        { id: "sambal", name: "Sambal Bawang Botol 200g", price: 32000, blurb: "Pedas level 3" },
        { id: "batik", name: "Kemeja Batik Tulis", price: 459000, blurb: "Katun primisima, lengan pendek" },
      ],
    },
    colleagues: { deployer: "Dimas", secondary: "Sekar", infra: "Rizky", support: "Putri" },
  },
  {
    id: "yogyakarta",
    name: "Yogyakarta",
    country: "Indonesia",
    timeZone: "Asia/Jakarta",
    currency: "IDR",
    brand: {
      name: "Guyub Kriya",
      domain: "guyubkriya.id",
      tagline: "Karya tangan lokal, dikirim ke seluruh Indonesia.",
      kind: "Marketplace UMKM",
      colors: { primary: "#7a4a1f", paper: "#fbf6ec", ink: "#2e2116" },
      products: [
        { id: "bakpia", name: "Bakpia Kacang Hijau isi 20", price: 45000, blurb: "Dipanggang pagi ini" },
        { id: "gudeg", name: "Gudeg Kaleng", price: 38000, blurb: "Tahan 12 bulan" },
        { id: "anyaman", name: "Tas Anyaman Pandan", price: 175000, blurb: "Dianyam tangan di Bantul" },
      ],
    },
    colleagues: { deployer: "Bayu", secondary: "Laras", infra: "Galih", support: "Wulan" },
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    timeZone: "Asia/Tokyo",
    currency: "JPY",
    brand: {
      name: "Yoimichi Market",
      domain: "yoimichi-market.jp",
      tagline: "Everyday tools for a quieter home.",
      kind: "Online store",
      colors: { primary: "#2f4a3a", paper: "#f6f3ec", ink: "#1f2320" },
      products: [
        { id: "kettle", name: "Cast Iron Kettle 1.2L", price: 12800, blurb: "Made in Iwate" },
        { id: "stool", name: "Hinoki Bath Stool", price: 6800, blurb: "Untreated cypress" },
        { id: "matcha", name: "Matcha Starter Set", price: 4200, blurb: "Whisk, bowl and 30g tin" },
      ],
    },
    colleagues: { deployer: "Kenji", secondary: "Aiko", infra: "Takumi", support: "Haruka" },
  },
  {
    id: "melbourne",
    name: "Melbourne",
    country: "Australia",
    timeZone: "Australia/Melbourne",
    currency: "AUD",
    brand: {
      name: "Tram & Co.",
      domain: "tramandco.com.au",
      tagline: "Good things for small apartments.",
      kind: "Online store",
      colors: { primary: "#1f5f8b", paper: "#f4f6f8", ink: "#16222b" },
      products: [
        { id: "beanie", name: "Merino Beanie", price: 3900, blurb: "Knitted in Victoria" },
        { id: "cup", name: "Reusable Ceramic Cup", price: 2800, blurb: "340 ml, fits under most group heads" },
        { id: "tote", name: "Market Tote", price: 4500, blurb: "Waxed canvas" },
      ],
    },
    colleagues: { deployer: "Josh", secondary: "Priya", infra: "Liam", support: "Chloe" },
  },
];
