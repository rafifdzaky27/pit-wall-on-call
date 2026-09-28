import { symptomCode } from "@pitwall/scenarios";
import { STORE_COPY } from "@pitwall/world";
import { useEffect, useRef, useState } from "react";
import { Glyph } from "../../brand/Glyph";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs } from "../../shell/OsContext";
import "./browser.css";
import { ErrorPage } from "./ErrorPage";
import { REASON } from "./http";
import { NetworkPanel } from "./NetworkPanel";
import { ROW_EVERY_TICKS, rowForTick, type NetRow } from "./network";
import { CheckoutPage, OrderPage, StorePage, type Cart } from "./StorePage";

type Route = "/" | "/checkout" | `/order/${string}`;
const MAX_ROWS = 150;
/** How long a simulated page load takes (presentation only). */
export const NAV_MS = 450;
export const PLACE_MS = 900;

export function BrowserApp() {
  const { world, content, scenario, snapshot, phase, seed } = useIncident();
  const { wm, dispatchWm } = useOs();
  const copy = STORE_COPY[world.brand.locale];
  const [route, setRoute] = useState<Route>("/");
  const [back, setBack] = useState<Route[]>([]);
  const [forward, setForward] = useState<Route[]>([]);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [cart, setCart] = useState<Cart>(() => Object.fromEntries(world.brand.products.slice(0, 2).map((p) => [p.id, 1])));
  const [showNet, setShowNet] = useState(false);
  const [preserve, setPreserve] = useState(false);
  const [rows, setRows] = useState<NetRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const lastTick = useRef(0);
  const code = symptomCode(scenario);
  const paged = phase === "paging" || phase === "active" || phase === "ended";
  const failing = paged && snapshot.errorRateBp >= 100;
  const failingNow = useRef(failing);
  const order = `${world.brand.name.slice(0, 3).toUpperCase()}-${String(seed % 1_000_000).padStart(6, "0")}`;

  useEffect(() => {
    failingNow.current = failing;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const commit = (next: Route) => {
    setRoute(next);
    if (!preserve) {
      setRows([]);
      setSelected(null);
    }
  };

  const navigate = (next: Route, history: "push" | "back" | "forward" | "reload") => {
    window.clearTimeout(timer.current);
    if (history === "push") {
      setBack((b) => [...b, route]);
      setForward([]);
    } else if (history === "back") {
      setBack((b) => b.slice(0, -1));
      setForward((f) => [route, ...f]);
    } else if (history === "forward") {
      setForward((f) => f.slice(1));
      setBack((b) => [...b, route]);
    }
    setLoading(true);
    timer.current = window.setTimeout(() => {
      setLoading(false);
      commit(next);
    }, NAV_MS);
  };

  const stop = () => {
    window.clearTimeout(timer.current);
    setLoading(false);
    setPlacing(false);
  };

  // The customer's tab reloads onto checkout, which is what breaks.
  useEffect(() => {
    if (!paged) return;
    stop();
    if (route !== "/checkout") {
      setBack((b) => [...b, route]);
      setForward([]);
      commit("/checkout");
    }
  }, [paged]);

  useEffect(() => {
    const tick = snapshot.tick;
    if (tick <= lastTick.current) return;
    const added: NetRow[] = [];
    for (let t = lastTick.current + 1; t <= tick; t++) {
      if (t % ROW_EVERY_TICKS === 0) added.push(rowForTick(content, code, seed, t, snapshot.errorRateBp));
    }
    lastTick.current = tick;
    if (added.length > 0) setRows((r) => [...r, ...added].slice(-MAX_ROWS));
  }, [snapshot.tick, snapshot.errorRateBp, content, code, seed]);

  const place = () => {
    window.clearTimeout(timer.current);
    setPlacing(true);
    setLoading(true);
    timer.current = window.setTimeout(() => {
      setPlacing(false);
      setLoading(false);
      // If checkout broke meanwhile, the page itself now shows the gateway error.
      if (failingNow.current) return;
      setBack((b) => [...b, route]);
      setForward([]);
      commit(`/order/${order}`);
      setCart({});
    }, PLACE_MS);
  };

  const closeTab = () => {
    const win = wm.windows.find((w) => w.appId === "browser" && !w.closing);
    if (win) dispatchWm({ type: "close", id: win.id });
  };

  const showError = route === "/checkout" && failing;
  const title = showError
    ? `${code} ${REASON[code]}`
    : route === "/checkout"
      ? `${copy.checkout} · ${world.brand.name}`
      : route.startsWith("/order/")
        ? `${copy.orderTitle} · ${world.brand.name}`
        : `${world.brand.name} · ${world.brand.tagline}`;

  let page;
  if (route === "/") {
    page = (
      <StorePage
        world={world}
        cart={cart}
        onAdd={(id) => setCart((c) => ({ ...c, [id]: (c[id] ?? 0) + 1 }))}
        onRemove={(id) => setCart((c) => ({ ...c, [id]: 0 }))}
        onCheckout={() => navigate("/checkout", "push")}
      />
    );
  } else if (route === "/checkout") {
    page = showError ? <ErrorPage code={code} server={content.server} /> : <CheckoutPage world={world} cart={cart} placing={placing} onPlace={place} />;
  } else {
    page = <OrderPage world={world} order={route.slice("/order/".length)} onContinue={() => navigate("/", "push")} />;
  }

  return (
    <div className="browser">
      <div className="browser-tabs">
        <div role="tablist" aria-label="Tabs" className="browser-tablist">
          <span role="tab" aria-selected="true" className="browser-tab">
            <span className={showError ? "favicon blank" : "favicon"} aria-hidden="true" />
            {title}
          </span>
        </div>
        <button type="button" className="tab-close" aria-label="Close tab" onClick={closeTab}>
          <Glyph name="close" size={14} />
        </button>
      </div>
      <div className="browser-toolbar">
        <button type="button" className="tool-btn" aria-label="Back" disabled={back.length === 0} onClick={() => navigate(back.at(-1)!, "back")}>
          <Glyph name="back" />
        </button>
        <button type="button" className="tool-btn" aria-label="Forward" disabled={forward.length === 0} onClick={() => navigate(forward[0]!, "forward")}>
          <Glyph name="forward" />
        </button>
        {loading ? (
          <button type="button" className="tool-btn" aria-label="Stop" onClick={stop}>
            <Glyph name="close" />
          </button>
        ) : (
          <button type="button" className="tool-btn" aria-label="Reload" onClick={() => navigate(route, "reload")}>
            <Glyph name="reload" />
          </button>
        )}
        <button type="button" className="tool-btn" aria-label="Home" onClick={() => navigate("/", "push")}>
          <Glyph name="home" />
        </button>
        <div className="omnibox">
          <Glyph name="lock" size={14} />
          <input className="address mono" aria-label="Address" value={`https://${world.brand.domain}${route}`} readOnly />
        </div>
        <button type="button" className="btn" aria-pressed={showNet} onClick={() => setShowNet((v) => !v)}>
          Network
        </button>
        {loading && <div className="loadbar" role="progressbar" aria-label="Loading page" />}
      </div>
      <div className={showNet ? "browser-main with-net" : "browser-main"}>
        <div className="browser-page">{page}</div>
        {showNet && (
          <NetworkPanel
            rows={rows}
            host={world.brand.domain}
            selected={selected}
            onSelect={setSelected}
            onClear={() => {
              setRows([]);
              setSelected(null);
            }}
            preserve={preserve}
            onPreserve={setPreserve}
          />
        )}
      </div>
    </div>
  );
}
