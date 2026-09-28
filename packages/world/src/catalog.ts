import type { Locale } from "./cities";

/** Store copy in each market's language and conventions (polish spec S21). In-world content. */
export interface StoreCopy {
  search: string;
  cart: string;
  addToCart: string;
  checkout: string;
  featured: string;
  categories: string;
  subtotal: string;
  total: string;
  shipping: string;
  payment: string;
  address: string;
  summary: string;
  placeOrder: string;
  placing: string;
  orderTitle: string;
  orderPlaced: (brand: string, order: string) => string;
  continueShopping: string;
  emptyCart: string;
  remove: string;
  close: string;
  noResults: (query: string) => string;
  footer: string[];
  rating: (rating: number, sold: number) => string;
  /** Prices in the market's minor units. */
  shippingOptions: { label: string; price: number }[];
  paymentOptions: string[];
  addressLines: string[];
}

function idSold(n: number): string {
  if (n < 1000) return String(n);
  return `${(Math.round(n / 100) / 10).toFixed(1).replace(/\.0$/, "").replace(".", ",")} rb`;
}

export const STORE_COPY: Record<Locale, StoreCopy> = {
  "id-ID": {
    search: "Cari produk",
    cart: "Keranjang",
    addToCart: "+ Keranjang",
    checkout: "Checkout",
    featured: "Pilihan hari ini",
    categories: "Kategori",
    subtotal: "Subtotal",
    total: "Total tagihan",
    shipping: "Pengiriman",
    payment: "Metode pembayaran",
    address: "Alamat pengiriman",
    summary: "Ringkasan belanja",
    placeOrder: "Buat pesanan",
    placing: "Memproses…",
    orderTitle: "Pesanan berhasil",
    orderPlaced: (brand, order) => `Pesanan ${order} berhasil dibuat. Terima kasih sudah belanja di ${brand}.`,
    continueShopping: "Lanjut belanja",
    emptyCart: "Keranjangmu masih kosong.",
    remove: "Hapus",
    close: "Tutup",
    noResults: (q) => `Tidak ada hasil untuk "${q}".`,
    footer: ["Tentang kami", "Bantuan", "Pengiriman", "Pengembalian", "Syarat & ketentuan"],
    rating: (r, n) => `★ ${r.toFixed(1).replace(".", ",")} · ${idSold(n)} terjual`,
    shippingOptions: [
      { label: "Reguler · 2–3 hari", price: 12000 },
      { label: "Instan · hari ini", price: 35000 },
    ],
    paymentOptions: ["Transfer virtual account", "Dompet digital", "Bayar di tempat (COD)"],
    addressLines: ["Rina Wulandari", "Jl. Kenanga No. 12, RT 04/RW 07", "Tebet, Jakarta Selatan 12810"],
  },
  "ja-JP": {
    search: "商品を検索",
    cart: "カート",
    addToCart: "カートに入れる",
    checkout: "レジに進む",
    featured: "今週のおすすめ",
    categories: "カテゴリ",
    subtotal: "小計",
    total: "合計（税込）",
    shipping: "配送方法",
    payment: "お支払い方法",
    address: "お届け先",
    summary: "ご注文内容",
    placeOrder: "注文を確定する",
    placing: "処理中…",
    orderTitle: "ご注文完了",
    orderPlaced: (brand, order) => `ご注文ありがとうございます。${brand} 注文番号 ${order}`,
    continueShopping: "買い物を続ける",
    emptyCart: "カートに商品がありません。",
    remove: "削除",
    close: "閉じる",
    noResults: (q) => `「${q}」に一致する商品はありません。`,
    footer: ["会社概要", "ヘルプ", "配送について", "返品・交換", "利用規約"],
    rating: (r, n) => `★${r.toFixed(1)}（${n.toLocaleString("en-US")}件）`,
    shippingOptions: [
      { label: "通常配送 · 2〜3日", price: 550 },
      { label: "お急ぎ便 · 翌日", price: 880 },
    ],
    paymentOptions: ["クレジットカード", "コンビニ払い", "代金引換"],
    addressLines: ["佐藤 美咲 様", "〒154-0024", "東京都世田谷区三軒茶屋 2-14-5"],
  },
  "en-AU": {
    search: "Search products",
    cart: "Cart",
    addToCart: "Add to cart",
    checkout: "Checkout",
    featured: "New this week",
    categories: "Categories",
    subtotal: "Subtotal",
    total: "Total (incl. GST)",
    shipping: "Delivery",
    payment: "Payment",
    address: "Deliver to",
    summary: "Order summary",
    placeOrder: "Place order",
    placing: "Placing order…",
    orderTitle: "Order confirmed",
    orderPlaced: (brand, order) => `Order ${order} confirmed. Thanks for shopping with ${brand}.`,
    continueShopping: "Continue shopping",
    emptyCart: "Your cart is empty.",
    remove: "Remove",
    close: "Close",
    noResults: (q) => `No results for "${q}".`,
    footer: ["About", "Help", "Delivery", "Returns", "Terms"],
    rating: (r, n) => `★ ${r.toFixed(1)} (${n.toLocaleString("en-AU")} reviews)`,
    shippingOptions: [
      { label: "Standard · 3–5 business days", price: 995 },
      { label: "Express · next business day", price: 1695 },
    ],
    paymentOptions: ["Card", "Bank transfer", "Pay in 4"],
    addressLines: ["Sam Nguyen", "12/48 Smith Street", "Fitzroy VIC 3065"],
  },
};
