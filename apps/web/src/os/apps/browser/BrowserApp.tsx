import { useCallback, useEffect, useRef, useState } from "react";
import { Glyph } from "../../brand/Glyph";
import { useIncident } from "../../incident/IncidentProvider";
import { useOs, type BrowserTabId } from "../../shell/OsContext";
import "./browser.css";
import { LEADERBOARD_TITLE, LeaderboardTab } from "./LeaderboardTab";
import { StoreTab, type TabMeta } from "./StoreTab";

export { NAV_MS, PLACE_MS } from "./StoreTab";

/**
 * Chromium-like tabs around two sites: the incident's store and the Pit Wall leaderboard (M2 spec §6).
 * An inactive tab stays mounted, hidden, so it keeps its page, history and DevTools rows.
 */
export function BrowserApp() {
  const { world } = useIncident();
  const { wm, dispatchWm, browserTab } = useOs();
  const [tabs, setTabs] = useState<BrowserTabId[]>(() => (browserTab?.id === "leaderboard" ? ["store", "leaderboard"] : ["store"]));
  const [active, setActive] = useState<BrowserTabId>(browserTab?.id ?? "store");
  const [storeMeta, setStoreMeta] = useState<TabMeta>({ title: "", blank: false });
  const [opened, setOpened] = useState(0);
  const handled = useRef(browserTab?.nonce ?? 0);

  const open = useCallback((id: BrowserTabId) => {
    setTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActive(id);
    if (id === "leaderboard") setOpened((n) => n + 1);
  }, []);

  // A request from elsewhere in PitOS (the postmortem's View leaderboard) selects that tab.
  useEffect(() => {
    if (!browserTab || browserTab.nonce === handled.current) return;
    handled.current = browserTab.nonce;
    open(browserTab.id);
  }, [browserTab, open]);

  const close = (id: BrowserTabId) => {
    const rest = tabs.filter((t) => t !== id);
    if (rest.length === 0) {
      // Closing the last tab closes the window, as in Chrome.
      const win = wm.windows.find((w) => w.appId === "browser" && !w.closing);
      if (win) dispatchWm({ type: "close", id: win.id });
      return;
    }
    setTabs(rest);
    if (active === id) setActive(rest.at(-1)!);
  };

  const bookmarks = (
    <div className="browser-bookmarks" role="toolbar" aria-label="Bookmarks">
      <button type="button" className="bookmark" onClick={() => open("store")}>
        <span className="favicon" aria-hidden="true" />
        {world.brand.name}
      </button>
      <button type="button" className="bookmark" onClick={() => open("leaderboard")}>
        <span className="favicon pitwall" aria-hidden="true" />
        Pit Wall leaderboard
      </button>
    </div>
  );

  const titles: Record<BrowserTabId, string> = { store: storeMeta.title, leaderboard: LEADERBOARD_TITLE };

  return (
    <div className="browser">
      <div className="browser-tabs">
        <div role="tablist" aria-label="Tabs" className="browser-tablist">
          {tabs.map((id) => (
            <div key={id} className="browser-tab-wrap" role="presentation">
              <button type="button" role="tab" aria-selected={active === id} className="browser-tab" onClick={() => setActive(id)}>
                <span className={id === "store" ? (storeMeta.blank ? "favicon blank" : "favicon") : "favicon pitwall"} aria-hidden="true" />
                {titles[id]}
              </button>
              <button type="button" className="tab-close" aria-label="Close tab" onClick={() => close(id)}>
                <Glyph name="close" size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>
      {tabs.includes("store") && (
        <div className="browser-view" hidden={active !== "store"}>
          <StoreTab bookmarks={bookmarks} onMeta={setStoreMeta} />
        </div>
      )}
      {tabs.includes("leaderboard") && (
        <div className="browser-view" hidden={active !== "leaderboard"}>
          <LeaderboardTab bookmarks={bookmarks} opened={opened} />
        </div>
      )}
    </div>
  );
}
