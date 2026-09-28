import { formatPrice, type World } from "@pitwall/world";
import { useState } from "react";

function useTotal(world: World) {
  return formatPrice(
    world.brand.products.reduce((sum, p) => sum + p.price, 0),
    world.city.currency,
  );
}

export function StorePage({ world, onCheckout }: { world: World; onCheckout: () => void }) {
  const { brand, city } = world;
  const total = useTotal(world);
  return (
    <div className="store" style={{ ["--store-primary" as string]: brand.colors.primary, ["--store-paper" as string]: brand.colors.paper, ["--store-ink" as string]: brand.colors.ink }}>
      <header className="store-head">
        <h1>{brand.name}</h1>
        <span>{brand.kind}</span>
      </header>
      <p className="store-tagline">{brand.tagline}</p>
      <div className="store-body">
        <ul className="store-grid">
          {brand.products.map((p) => (
            <li key={p.id} className="store-item">
              <div className="store-swatch" aria-hidden="true" />
              <b>{p.name}</b>
              <span>{p.blurb}</span>
              <span className="store-price">{formatPrice(p.price, city.currency)}</span>
            </li>
          ))}
        </ul>
        <aside className="store-cart" aria-label="Cart">
          <h2>Cart</h2>
          <ul>
            {brand.products.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <span>{formatPrice(p.price, city.currency)}</span>
              </li>
            ))}
          </ul>
          <p className="store-total">
            <span>Total</span>
            <b>{total}</b>
          </p>
          <button type="button" className="store-pay" onClick={onCheckout}>
            Checkout
          </button>
        </aside>
      </div>
    </div>
  );
}

export function CheckoutPage({ world }: { world: World }) {
  const [placed, setPlaced] = useState(false);
  const total = useTotal(world);
  return (
    <div className="store" style={{ ["--store-primary" as string]: world.brand.colors.primary, ["--store-paper" as string]: world.brand.colors.paper, ["--store-ink" as string]: world.brand.colors.ink }}>
      <header className="store-head">
        <h1>{world.brand.name}</h1>
        <span>Checkout</span>
      </header>
      {placed ? (
        <p className="store-done" role="status">
          Order placed. Thank you for shopping with {world.brand.name}.
        </p>
      ) : (
        <div className="store-checkout">
          <p className="store-total">
            <span>Order total</span>
            <b>{total}</b>
          </p>
          <button type="button" className="store-pay" onClick={() => setPlaced(true)}>
            Place order
          </button>
        </div>
      )}
    </div>
  );
}
