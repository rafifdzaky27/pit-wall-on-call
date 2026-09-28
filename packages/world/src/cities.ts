export type CityId = "jakarta" | "yogyakarta" | "tokyo" | "melbourne";
export type CurrencyCode = "IDR" | "JPY" | "AUD";
export type ColleagueRole = "deployer" | "secondary" | "infra" | "support";
export type Locale = "id-ID" | "ja-JP" | "en-AU";

export interface Product {
  id: string;
  name: string;
  /** Minor units: rupiah, yen, or Australian cents. */
  price: number;
  /** The struck-through price before the discount, in the same units. */
  was?: number;
  blurb: string;
  /** One of the brand's categories (M1.6 F4). */
  category: string;
  /** Photo file in /store without the extension, "<city>-<key>". */
  image: string;
  rating: number;
  /** Units sold (Indonesian marketplaces) or reviews (elsewhere). */
  sold: number;
}

export interface Brand {
  name: string;
  domain: string;
  tagline: string;
  kind: string;
  locale: Locale;
  colors: { primary: string; paper: string; ink: string };
  categories: string[];
  banner: { image: string; headline: string; sub: string };
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

// Every brand here is fictional (spec D19). Names and domains were checked against real companies
// in their market (M1.5 plan, Task 2). Products follow the free Unsplash photos in /store (polish plan R8).
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
      locale: "id-ID",
      colors: { primary: "#d2452f", paper: "#fff8f2", ink: "#2b1b16" },
      categories: ["Minuman", "Makanan", "Fashion"],
      banner: { image: "jakarta-banner", headline: "Gajian Sale: diskon sampai 50%", sub: "Gratis ongkir se-Jabodetabek untuk belanja di atas Rp100.000" },
      products: [
        { id: "kopi", category: "Minuman", name: "Kopi Susu Gula Aren 1L", price: 89000, was: 109000, blurb: "Siap minum, simpan dingin", image: "jakarta-kopi", rating: 4.8, sold: 2100 },
        { id: "sambal", category: "Makanan", name: "Sambal Bawang Botol 200g", price: 32000, blurb: "Pedas level 3", image: "jakarta-sambal", rating: 4.9, sold: 12400 },
        { id: "batik", category: "Fashion", name: "Kain Batik Cap Kawung 2 m", price: 185000, was: 230000, blurb: "Katun primisima, motif kawung", image: "jakarta-batik", rating: 4.7, sold: 860 },
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
      locale: "id-ID",
      colors: { primary: "#7a4a1f", paper: "#fbf6ec", ink: "#2e2116" },
      categories: ["Batik", "Kerajinan", "Kuliner Khas"],
      banner: { image: "yogyakarta-banner", headline: "Karya perajin Jogja, langsung dari bengkelnya", sub: "Setiap pembelian mendukung lebih dari 120 UMKM di DIY" },
      products: [
        { id: "gudeg", category: "Kuliner Khas", name: "Paket Gudeg Komplit", price: 65000, blurb: "Gudeg, krecek, telur dan ayam kampung", image: "yogyakarta-gudeg", rating: 4.8, sold: 3200 },
        { id: "anyaman", category: "Kerajinan", name: "Tas Anyaman Pandan", price: 175000, was: 210000, blurb: "Dianyam tangan di Bantul", image: "yogyakarta-anyaman", rating: 4.9, sold: 540 },
        { id: "parang", category: "Batik", name: "Kain Batik Tulis Parang 2 m", price: 450000, blurb: "Pewarna alami, dibuat tiga minggu", image: "yogyakarta-parang", rating: 5, sold: 96 },
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
      tagline: "静かな暮らしのための道具",
      kind: "Online store",
      locale: "ja-JP",
      colors: { primary: "#2f4a3a", paper: "#f6f3ec", ink: "#1f2320" },
      categories: ["キッチン", "インテリア", "お茶"],
      banner: { image: "tokyo-banner", headline: "秋の暮らし支度フェア", sub: "5,000円以上のご注文で送料無料" },
      products: [
        { id: "kettle", category: "キッチン", name: "南部鉄器 鉄瓶 1.2L", price: 12800, blurb: "盛岡の工房で鋳造", image: "tokyo-kettle", rating: 4.8, sold: 1204 },
        { id: "stool", category: "インテリア", name: "オーク スツール", price: 6800, was: 8200, blurb: "北海道産オーク無垢材", image: "tokyo-stool", rating: 4.6, sold: 318 },
        { id: "matcha", category: "お茶", name: "抹茶スターターセット", price: 4200, blurb: "茶筅・茶碗・抹茶30g", image: "tokyo-matcha", rating: 4.9, sold: 2045 },
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
      locale: "en-AU",
      colors: { primary: "#1f5f8b", paper: "#f4f6f8", ink: "#16222b" },
      categories: ["Kitchen", "Wear", "Carry"],
      banner: { image: "melbourne-banner", headline: "Spring edit: 20% off homewares", sub: "Free delivery over $80 Australia-wide" },
      products: [
        { id: "beanie", category: "Wear", name: "Merino Beanie", price: 3900, blurb: "Knitted in Victoria", image: "melbourne-beanie", rating: 4.7, sold: 312 },
        { id: "cup", category: "Kitchen", name: "Reusable Ceramic Cup", price: 2800, was: 3500, blurb: "340 ml, fits under most group heads", image: "melbourne-cup", rating: 4.8, sold: 1180 },
        { id: "tote", category: "Carry", name: "Market Tote", price: 4500, blurb: "Waxed canvas", image: "melbourne-tote", rating: 4.6, sold: 204 },
      ],
    },
    colleagues: { deployer: "Josh", secondary: "Priya", infra: "Liam", support: "Chloe" },
  },
];
