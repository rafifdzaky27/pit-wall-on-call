import { symptomCode } from "@pitwall/scenarios";
import { useEffect, useRef, useState } from "react";
import { Glyph } from "../../brand/Glyph";
import { useIncident } from "../../incident/IncidentProvider";
import { ErrorPage } from "./ErrorPage";
import { REASON } from "./http";
import { NetworkPanel } from "./NetworkPanel";
import { ROW_EVERY_TICKS, rowForTick, type NetRow } from "./network";
import { CheckoutPage, StorePage } from "./StorePage";

type Route = "/" | "/checkout";
const MAX_ROWS = 100;

export function BrowserApp() {
  const { world, content, scenario, snapshot, phase, seed } = useIncident();
  const [route, setRoute] = useState<Route>("/");
  const [back, setBack] = useState<Route[]>([]);
  const [showNet, setShowNet] = useState(false);
  const [rows, setRows] = useState<NetRow[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const lastTick = useRef(0);
  const code = symptomCode(scenario);
  const paged = phase === "paging" || phase === "active" || phase === "ended";
  const failing = paged && snapshot.errorRateBp >= 100;

  const go = (next: Route) => {
    setBack((b) => [...b, route]);
    setRoute(next);
  };

  // The customer's view of the page: the checkout tab is what breaks.
  useEffect(() => {
    if (!paged) return;
    setRoute((current) => {
      if (current !== "/checkout") setBack((b) => [...b, current]);
      return "/checkout";
    });
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

  const showError = route === "/checkout" && failing;
  const tabTitle = showError ? `${code} ${REASON[code]}` : route === "/checkout" ? `Checkout · ${world.brand.name}` : world.brand.name;

  return (
    <div className="browser">
      <div className="browser-tabs" role="tablist" aria-label="Tabs">
        <span role="tab" aria-selected="true" className="browser-tab">
          {tabTitle}
        </span>
      </div>
      <div className="browser-toolbar">
        <button
          type="button"
          className="tool-btn"
          aria-label="Back"
          disabled={back.length === 0}
          onClick={() => {
            const prev = back.at(-1);
            if (!prev) return;
            setBack((b) => b.slice(0, -1));
            setRoute(prev);
          }}
        >
          <Glyph name="back" />
        </button>
        <button type="button" className="tool-btn" aria-label="Reload" onClick={() => setRoute((r) => r)}>
          <Glyph name="reload" />
        </button>
        <input className="address mono" aria-label="Address" value={`https://${world.brand.domain}${route}`} readOnly />
        <button type="button" className="btn" aria-pressed={showNet} onClick={() => setShowNet((v) => !v)}>
          Network
        </button>
      </div>
      <div className={showNet ? "browser-main with-net" : "browser-main"}>
        <div className="browser-page">
          {route === "/" ? <StorePage world={world} onCheckout={() => go("/checkout")} /> : showError ? <ErrorPage code={code} server={content.server} /> : <CheckoutPage world={world} />}
        </div>
        {showNet && <NetworkPanel rows={rows} selected={selected} onSelect={setSelected} />}
      </div>
    </div>
  );
}
