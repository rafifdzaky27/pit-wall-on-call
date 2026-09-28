import type { Locale } from "./cities";

export type InfoSlug = "about" | "help" | "shipping" | "returns" | "terms";

/** A footer page (M1.6 F4). The body may use {brand}. */
export interface InfoPage {
  slug: InfoSlug;
  label: string;
  title: string;
  body: string[];
}

/** Store copy in each market's language and conventions (polish spec S21). In-world content. */
export interface StoreCopy {
  search: string;
  cart: string;
  addToCart: string;
  checkout: string;
  featured: string;
  categories: string;
  /** The category filter that shows every product. */
  all: string;
  backToShop: string;
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
  footer: InfoPage[];
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
    all: "Semua",
    backToShop: "Kembali belanja",
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
    footer: [
      { slug: "about", label: "Tentang kami", title: "Tentang {brand}", body: ["{brand} menghubungkan pembeli dengan penjual lokal sejak 2019.", "Tim kami bekerja dari Indonesia untuk pembeli di seluruh negeri."] },
      { slug: "help", label: "Bantuan", title: "Pusat bantuan", body: ["Butuh bantuan soal pesanan? Chat CS kami 24 jam.", "Rata-rata kami membalas dalam 5 menit."] },
      { slug: "shipping", label: "Pengiriman", title: "Info pengiriman", body: ["Pesanan sebelum pukul 14.00 dikirim di hari yang sama.", "Gratis ongkir untuk belanja di atas Rp100.000."] },
      { slug: "returns", label: "Pengembalian", title: "Pengembalian barang", body: ["Barang bisa dikembalikan dalam 7 hari setelah diterima.", "Dana kembali ke metode pembayaran awal."] },
      { slug: "terms", label: "Syarat & ketentuan", title: "Syarat & ketentuan", body: ["Dengan berbelanja, kamu menyetujui syarat penggunaan {brand}.", "Harga dapat berubah sewaktu-waktu."] },
    ],
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
    all: "すべて",
    backToShop: "ショップに戻る",
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
    footer: [
      { slug: "about", label: "会社概要", title: "{brand}について", body: ["{brand}は、日本の職人の道具を暮らしに届けるオンラインショップです。", "本社は東京都目黒区にあります。"] },
      { slug: "help", label: "ヘルプ", title: "ヘルプセンター", body: ["ご注文についてのお問い合わせは、チャットで24時間受け付けています。", "通常5分以内にお返事します。"] },
      { slug: "shipping", label: "配送について", title: "配送について", body: ["14時までのご注文は当日発送します。", "5,000円以上のお買い上げで送料無料です。"] },
      { slug: "returns", label: "返品・交換", title: "返品・交換", body: ["商品到着後7日以内であれば返品・交換を承ります。", "返金は元のお支払い方法に戻ります。"] },
      { slug: "terms", label: "利用規約", title: "利用規約", body: ["ご利用により、{brand}の利用規約に同意したものとみなします。", "価格は予告なく変更される場合があります。"] },
    ],
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
    all: "All",
    backToShop: "Back to the shop",
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
    footer: [
      { slug: "about", label: "About", title: "About {brand}", body: ["{brand} sells small-batch goods from Melbourne makers.", "We have been based in Fitzroy since 2018."] },
      { slug: "help", label: "Help", title: "Help centre", body: ["Questions about an order? Chat with us any time.", "We usually reply within five minutes."] },
      { slug: "shipping", label: "Delivery", title: "Delivery", body: ["Orders placed before 2 pm ship the same day.", "Free delivery on orders over $80."] },
      { slug: "returns", label: "Returns", title: "Returns", body: ["Change of mind? Return it within 30 days.", "Refunds go back to your original payment method."] },
      { slug: "terms", label: "Terms", title: "Terms of use", body: ["By shopping with {brand} you agree to our terms of use.", "Prices may change without notice."] },
    ],
    rating: (r, n) => `★ ${r.toFixed(1)} (${n.toLocaleString("en-AU")} reviews)`,
    shippingOptions: [
      { label: "Standard · 3–5 business days", price: 995 },
      { label: "Express · next business day", price: 1695 },
    ],
    paymentOptions: ["Card", "Bank transfer", "Pay in 4"],
    addressLines: ["Sam Nguyen", "12/48 Smith Street", "Fitzroy VIC 3065"],
  },
};
