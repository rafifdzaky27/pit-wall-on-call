import type { ColdOpenDef } from "@pitwall/engine";
import { useEffect, useState } from "react";
import { fillBrand } from "../game/brand";
import { formatClock } from "../game/format";

interface Props {
  coldOpen: ColdOpenDef;
  brand: string;
  phase: "prepage" | "paging";
  ticks: number;
  escalated: boolean;
  onInspect: (hotspotId: string) => void;
  onSkip: () => void;
  onAck: () => void;
}

/** M1 minimal cold open: a card over a dimmed backdrop. M1.5 replaces it with the café scene. */
export function ColdOpen({ coldOpen, brand, phase, ticks, escalated, onInspect, onSkip, onAck }: Props) {
  const [opened, setOpened] = useState<string[]>([]);
  const paging = phase === "paging";
  const hotspots = Object.entries(coldOpen.hotspots).filter(([, h]) => paging || h.appearsAt !== "incident_start");

  useEffect(() => {
    if (!paging) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "a" || e.key === "A") && !e.ctrlKey && !e.metaKey && !e.altKey) onAck();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paging, onAck]);

  const open = (id: string) => {
    if (opened.includes(id)) return;
    setOpened([...opened, id]);
    onInspect(id);
  };

  return (
    <div className="cold-open">
      <div
        className={paging ? "co-card paging" : "co-card"}
        role={paging ? "alertdialog" : "region"}
        aria-labelledby="co-title"
        aria-describedby="co-body"
      >
        {paging ? (
          <>
            <div className="co-meta">
              <span className="tag crit">{coldOpen.page.severity}</span>
              <span>
                Paging you · <span className="mono">{formatClock(ticks)}</span>
              </span>
            </div>
            <h1 id="co-title">{coldOpen.page.title}</h1>
            <p id="co-body">{fillBrand(coldOpen.page.body, brand)}</p>
            {escalated && (
              <p className="co-escalated" role="status">
                <span className="tag warn">Escalated</span> No acknowledgement for 60 s. Paging the secondary on-call.
              </p>
            )}
            <button type="button" className="btn primary btn-lg co-ack" onClick={onAck} autoFocus>
              Acknowledge <kbd>A</kbd>
            </button>
          </>
        ) : (
          <>
            <div className="co-meta">
              <span className="tag info">On call</span>
              <span>{brand}</span>
            </div>
            <h1 id="co-title">A quiet evening at the café</h1>
            <p id="co-body">
              You are the primary on-call for {brand}. Nothing is broken yet. The incident clock starts when the pager goes off.
            </p>
          </>
        )}

        <div className="co-look">
          <h2>{paging ? "Around you, while the clock runs" : "Look around"}</h2>
          <ul>
            {hotspots.map(([id, h]) => (
              <li key={id}>
                <button type="button" className="co-hotspot" aria-expanded={opened.includes(id)} onClick={() => open(id)}>
                  {h.label}
                </button>
                {opened.includes(id) && <p className="co-reveal">{fillBrand(h.text, brand)}</p>}
              </li>
            ))}
          </ul>
        </div>

        {!paging && (
          <div className="co-foot">
            <button type="button" className="btn" onClick={onSkip}>
              Skip to the page
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
