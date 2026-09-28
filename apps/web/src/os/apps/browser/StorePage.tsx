import { fillWorld, formatPrice, STORE_COPY, type InfoSlug, type Product, type World } from "@pitwall/world";
import { useState, type CSSProperties, type ReactNode } from "react";

export type Cart = Record<string, number>;

const photo = (key: string) => `/store/${key}.webp`;

function vars(world: World): CSSProperties {
  const { colors } = world.brand;
  return { "--store-primary": colors.primary, "--store-paper": colors.paper, "--store-ink": colors.ink } as CSSProperties;
}

export function cartLines(world: World, cart: Cart): { product: Product; qty: number }[] {
  return world.brand.products.filter((p) => (cart[p.id] ?? 0) > 0).map((p) => ({ product: p, qty: cart[p.id]! }));
}

export function cartCount(cart: Cart): number {
  return Object.values(cart).reduce((a, b) => a + b, 0);
}

function subtotalOf(world: World, cart: Cart): number {
  return cartLines(world, cart).reduce((s, l) => s + l.product.price * l.qty, 0);
}

/** The store's own page frame: its colours, its language. */
function Page({ world, className, children }: { world: World; className?: string; children: ReactNode }) {
  return (
    <div className={className ? `store ${className}` : "store"} lang={world.brand.locale} style={vars(world)}>
      {children}
    </div>
  );
}

interface StoreProps {
  world: World;
  cart: Cart;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onCheckout: () => void;
  onInfo: (slug: InfoSlug) => void;
}

export function StorePage({ world, cart, onAdd, onRemove, onCheckout, onInfo }: StoreProps) {
  const { brand, city } = world;
  const copy = STORE_COPY[brand.locale];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<string | null>(null);
  const price = (n: number) => formatPrice(n, city.currency);
  const q = query.trim().toLowerCase();
  const shown = brand.products.filter((p) => (cat === null || p.category === cat) && p.name.toLowerCase().includes(q));
  const lines = cartLines(world, cart);

  return (
    <Page world={world}>
      <p className="st-promo">{brand.banner.sub}</p>
      <header className="st-head">
        <h1 className="st-logo">{brand.name}</h1>
        <input type="search" className="st-search" aria-label={copy.search} placeholder={copy.search} value={query} onChange={(e) => setQuery(e.target.value)} />
        <button type="button" className="st-cart" aria-label={`${copy.cart}, ${cartCount(cart)}`} onClick={() => setOpen(true)}>
          {copy.cart}
          <span className="st-count" aria-hidden="true">
            {cartCount(cart)}
          </span>
        </button>
      </header>
      <ul className="st-cats" aria-label={copy.categories}>
        {[null, ...brand.categories].map((c) => (
          <li key={c ?? ""}>
            <button type="button" aria-pressed={cat === c} onClick={() => setCat(c)}>
              {c ?? copy.all}
            </button>
          </li>
        ))}
      </ul>
      <section className="st-hero">
        <img src={photo(brand.banner.image)} alt="" width={1200} height={400} />
        <div className="st-hero-text">
          <h2>{brand.banner.headline}</h2>
          <p>{brand.tagline}</p>
        </div>
      </section>
      <h2 className="st-sec">{copy.featured}</h2>
      {shown.length === 0 ? (
        <p className="st-none">{copy.noResults(query.trim())}</p>
      ) : (
        <ul className="st-grid">
          {shown.map((p) => (
            <li key={p.id} className="st-card">
              <img src={photo(p.image)} alt={p.name} width={480} height={480} loading="lazy" />
              <div className="st-card-body">
                <p className="st-name">{p.name}</p>
                <p className="st-blurb">{p.blurb}</p>
                <p className="st-rating">{copy.rating(p.rating, p.sold)}</p>
                <p className="st-price">
                  <b>{price(p.price)}</b>
                  {p.was !== undefined && (
                    <>
                      <s>{price(p.was)}</s>
                      <span className="st-off">-{Math.round((1 - p.price / p.was) * 100)}%</span>
                    </>
                  )}
                </p>
                <button type="button" className="st-add" onClick={() => onAdd(p.id)}>
                  {copy.addToCart}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <footer className="st-foot">
        <ul>
          {copy.footer.map((f) => (
            <li key={f.slug}>
              <button type="button" onClick={() => onInfo(f.slug)}>
                {f.label}
              </button>
            </li>
          ))}
        </ul>
        <p>© 2026 {brand.name}</p>
      </footer>
      {open && (
        <>
          <div className="st-scrim" aria-hidden="true" onClick={() => setOpen(false)} />
          <aside className="st-drawer" role="dialog" aria-label={copy.cart}>
            <header className="st-drawer-head">
              <h2>{copy.cart}</h2>
              <button type="button" className="st-x" aria-label={copy.close} onClick={() => setOpen(false)}>
                ×
              </button>
            </header>
            {lines.length === 0 ? (
              <p className="st-none">{copy.emptyCart}</p>
            ) : (
              <ul className="st-lines">
                {lines.map(({ product, qty }) => (
                  <li key={product.id}>
                    <img src={photo(product.image)} alt="" width={56} height={56} />
                    <div>
                      <p>{product.name}</p>
                      <p className="st-qty">
                        {qty} × {price(product.price)}
                      </p>
                    </div>
                    <button type="button" className="st-link" onClick={() => onRemove(product.id)}>
                      {copy.remove}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="st-total">
              <span>{copy.subtotal}</span>
              <b>{price(subtotalOf(world, cart))}</b>
            </p>
            <button type="button" className="st-pay" disabled={lines.length === 0} onClick={onCheckout}>
              {copy.checkout}
            </button>
          </aside>
        </>
      )}
    </Page>
  );
}

export function CheckoutPage({ world, cart, placing, onPlace }: { world: World; cart: Cart; placing: boolean; onPlace: () => void }) {
  const { brand, city } = world;
  const copy = STORE_COPY[brand.locale];
  const [ship, setShip] = useState(0);
  const [pay, setPay] = useState(0);
  const price = (n: number) => formatPrice(n, city.currency);
  const lines = cartLines(world, cart);
  const subtotal = subtotalOf(world, cart);
  const shipping = lines.length > 0 ? copy.shippingOptions[ship]!.price : 0;

  return (
    <Page world={world} className="st-checkout">
      <header className="st-head slim">
        <h1 className="st-logo">{brand.name}</h1>
        <span className="st-step">{copy.checkout}</span>
      </header>
      <div className="st-co">
        <div className="st-co-main">
          <section className="st-box">
            <h2>{copy.address}</h2>
            <address>
              {copy.addressLines.map((l) => (
                <span key={l}>{l}</span>
              ))}
            </address>
          </section>
          <fieldset className="st-box">
            <legend>{copy.shipping}</legend>
            {copy.shippingOptions.map((o, i) => (
              <label key={o.label} className="st-opt">
                <input type="radio" name="ship" checked={ship === i} onChange={() => setShip(i)} />
                <span>{o.label}</span>
                <b>{price(o.price)}</b>
              </label>
            ))}
          </fieldset>
          <fieldset className="st-box">
            <legend>{copy.payment}</legend>
            {copy.paymentOptions.map((o, i) => (
              <label key={o} className="st-opt">
                <input type="radio" name="pay" checked={pay === i} onChange={() => setPay(i)} />
                <span>{o}</span>
              </label>
            ))}
          </fieldset>
        </div>
        <aside className="st-box st-summary">
          <h2>{copy.summary}</h2>
          <ul>
            {lines.map(({ product, qty }) => (
              <li key={product.id}>
                <span>
                  {qty}× {product.name}
                </span>
                <span>{price(product.price * qty)}</span>
              </li>
            ))}
          </ul>
          <p className="st-row">
            <span>{copy.subtotal}</span>
            <span>{price(subtotal)}</span>
          </p>
          <p className="st-row">
            <span>{copy.shipping}</span>
            <span>{price(shipping)}</span>
          </p>
          <p className="st-total">
            <span>{copy.total}</span>
            <b>{price(subtotal + shipping)}</b>
          </p>
          <button type="button" className="st-pay" disabled={placing || lines.length === 0} aria-busy={placing} onClick={onPlace}>
            {placing ? copy.placing : copy.placeOrder}
          </button>
        </aside>
      </div>
    </Page>
  );
}

export function OrderPage({ world, order, onContinue }: { world: World; order: string; onContinue: () => void }) {
  const copy = STORE_COPY[world.brand.locale];
  return (
    <Page world={world} className="st-done">
      <header className="st-head slim">
        <h1 className="st-logo">{world.brand.name}</h1>
      </header>
      <div className="st-box st-confirm">
        <h2>{copy.orderTitle}</h2>
        <p role="status">{copy.orderPlaced(world.brand.name, order)}</p>
        <button type="button" className="st-pay" onClick={onContinue}>
          {copy.continueShopping}
        </button>
      </div>
    </Page>
  );
}

/** A footer page: About, Help, Shipping, Returns or Terms, in the store's language (M1.6 F4). */
export function InfoPage({ world, slug, onBack }: { world: World; slug: InfoSlug; onBack: () => void }) {
  const copy = STORE_COPY[world.brand.locale];
  const info = copy.footer.find((f) => f.slug === slug)!;
  return (
    <Page world={world} className="st-done">
      <header className="st-head slim">
        <h1 className="st-logo">{world.brand.name}</h1>
      </header>
      <article className="st-box st-info">
        <h2>{fillWorld(info.title, world)}</h2>
        {info.body.map((line) => (
          <p key={line}>{fillWorld(line, world)}</p>
        ))}
        <button type="button" className="st-pay" onClick={onBack}>
          {copy.backToShop}
        </button>
      </article>
    </Page>
  );
}
