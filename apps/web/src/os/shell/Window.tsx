import { useEffect, useLayoutEffect, useRef, useState, type Dispatch, type PointerEvent, type ReactNode } from "react";
import { Glyph } from "../brand/Glyph";
import { animate, DUR, EASE_IN, EASE_OUT } from "../motion";
import { frameOf, resizeFrom, type Bounds, type Edge, type Size, type WindowMode, type WindowState, type WmAction } from "../wm/wm";

interface Props {
  win: WindowState;
  area: Size;
  focused: boolean;
  /** z-index from the window's rank in the stack (DESIGN.md §9: windows use 10–999). */
  layer: number;
  dispatch: Dispatch<WmAction>;
  /** A move or resize is in progress: the dock reveals itself (polish spec §3). */
  onDragChange?: (dragging: boolean) => void;
  children: ReactNode;
}

type Drag =
  | { kind: "move"; px: number; py: number; start: Bounds; restored: boolean; moved: boolean }
  | { kind: "resize"; edge: Edge; px: number; py: number; start: Bounds };

const EDGES: readonly Edge[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];
/** Snapped windows resize only from their inner edge, and maximized ones not at all, as in GNOME (M1.6 F3). */
function edgesFor(mode: WindowMode): readonly Edge[] {
  if (mode === "maximized") return [];
  if (mode === "left") return ["e"];
  if (mode === "right") return ["w"];
  return EDGES;
}
/** How far a maximized or snapped window is dragged before it restores (polish spec §4). */
const RESTORE_AFTER = 6;

/** Transform that shrinks the window onto its dock icon, for minimize and restore. */
function towardDock(appId: string, el: HTMLElement): string | null {
  const icon = document.querySelector(`[data-dock-app="${appId}"]`);
  if (!icon) return null;
  const a = icon.getBoundingClientRect();
  const b = el.getBoundingClientRect();
  const dx = Math.round(a.left + a.width / 2 - (b.left + b.width / 2));
  const dy = Math.round(a.top + a.height / 2 - (b.top + b.height / 2));
  return `translate(${dx}px, ${dy}px) scale(0.08)`;
}

export function Window({ win, area, focused, layer, dispatch, onDragChange, children }: Props) {
  const frame = frameOf(win, area);
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<Drag | null>(null);
  const previous = useRef<{ frame: Bounds; mode: WindowMode } | null>(null);
  const restoring = useRef(false);
  const [shown, setShown] = useState(!win.minimized);
  const maximized = win.mode === "maximized";

  // Open: fade in and grow from 96 %. Before the first paint, so the window never shows once at full size first.
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !win.minimized) animate(el, [{ opacity: 0, transform: "scale(0.96)" }, { opacity: 1, transform: "none" }], { duration: DUR.base, easing: EASE_OUT });
  }, []);

  // Close: play the exit, then ask the window manager to remove the window.
  useEffect(() => {
    if (!win.closing) return;
    const remove = () => dispatch({ type: "remove", id: win.id });
    const el = ref.current;
    const exit = el ? animate(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.96)" }], { duration: DUR.fast, easing: EASE_IN, fill: "forwards" }) : null;
    if (exit) void exit.then(remove);
    else remove();
  }, [win.closing, win.id, dispatch]);

  // Minimize flies into the dock icon; restoring flies back out.
  useLayoutEffect(() => {
    const el = ref.current;
    if (win.minimized && shown) {
      const to = el ? towardDock(win.appId, el) : null;
      const out = el && to ? animate(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: to }], { duration: DUR.slow, easing: EASE_IN, fill: "forwards" }) : null;
      if (out) void out.then(() => setShown(false));
      else setShown(false);
    } else if (!win.minimized && !shown) {
      restoring.current = true;
      setShown(true);
    }
  }, [win.minimized, shown, win.appId]);

  useLayoutEffect(() => {
    if (!shown || !restoring.current) return;
    restoring.current = false;
    const el = ref.current;
    if (!el) return;
    el.getAnimations?.().forEach((a) => a.cancel());
    const from = towardDock(win.appId, el);
    if (from) animate(el, [{ opacity: 0, transform: from }, { opacity: 1, transform: "none" }], { duration: DUR.slow, easing: EASE_OUT });
  }, [shown, win.appId]);

  // Maximize, restore and snap: FLIP from the old frame to the new one.
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = { frame, mode: win.mode };
    const el = ref.current;
    if (!before || !el || before.mode === win.mode || drag.current) return;
    const { x, y, w, h } = before.frame;
    animate(
      el,
      [
        { transformOrigin: "0 0", transform: `translate(${x - frame.x}px, ${y - frame.y}px) scale(${w / frame.w}, ${h / frame.h})` },
        { transformOrigin: "0 0", transform: "none" },
      ],
      { duration: DUR.base, easing: EASE_OUT },
    );
  }, [win.mode, frame.x, frame.y, frame.w, frame.h]);

  const beginMove = (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { kind: "move", px: e.clientX, py: e.clientY, start: frame, restored: win.mode === "normal", moved: false };
  };

  const beginResize = (edge: Edge) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { kind: "resize", edge, px: e.clientX, py: e.clientY, start: frame };
    onDragChange?.(true);
  };

  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (d.kind === "resize") {
      dispatch({ type: "setBounds", id: win.id, bounds: resizeFrom(d.start, d.edge, dx, dy, win.min, area) });
      return;
    }
    if (!d.restored) {
      if (Math.abs(dx) + Math.abs(dy) < RESTORE_AFTER) return;
      // A maximized or snapped window restores to its normal size, keeping the pointer at the
      // same fraction of the title bar.
      const fx = Math.min(1, Math.max(0, (d.px - d.start.x) / d.start.w));
      const { w, h } = win.bounds;
      const bounds = { x: Math.round(e.clientX - fx * w), y: d.start.y + dy, w, h };
      dispatch({ type: "setBounds", id: win.id, bounds });
      drag.current = { kind: "move", px: e.clientX, py: e.clientY, start: bounds, restored: true, moved: true };
      onDragChange?.(true);
      return;
    }
    if (!d.moved) {
      d.moved = true;
      onDragChange?.(true);
    }
    dispatch({ type: "move", id: win.id, x: d.start.x + dx, y: d.start.y + dy });
  };

  const end = () => {
    const d = drag.current;
    drag.current = null;
    if (d && (d.kind === "resize" || d.moved)) onDragChange?.(false);
  };

  const classes = ["window", focused && "focused", win.mode !== "normal" && win.mode, win.closing && "closing"].filter(Boolean).join(" ");

  return (
    <section
      ref={ref}
      className={classes}
      style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h, zIndex: layer }}
      aria-label={win.title}
      hidden={!shown}
      data-app={win.appId}
      onPointerDownCapture={() => {
        if (!focused) dispatch({ type: "focus", id: win.id });
      }}
    >
      <header
        className="titlebar"
        onPointerDown={beginMove}
        onPointerMove={onMove}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={(e) => {
          if (!(e.target as HTMLElement).closest("button")) dispatch({ type: "toggleMaximize", id: win.id });
        }}
      >
        <span className="titlebar-title">{win.title}</span>
        <div className="titlebar-controls">
          <button type="button" aria-label={`Minimize ${win.title}`} onClick={() => dispatch({ type: "minimize", id: win.id })}>
            <Glyph name="minimize" />
          </button>
          <button type="button" aria-label={`${maximized ? "Restore" : "Maximize"} ${win.title}`} onClick={() => dispatch({ type: "toggleMaximize", id: win.id })}>
            <Glyph name={maximized ? "restore" : "maximize"} />
          </button>
          <button type="button" className="close" aria-label={`Close ${win.title}`} onClick={() => dispatch({ type: "close", id: win.id })}>
            <Glyph name="close" />
          </button>
        </div>
      </header>
      <div className="window-body">{children}</div>
      {edgesFor(win.mode).map((edge) => (
          <div key={edge} className={`rz rz-${edge}`} aria-hidden="true" onPointerDown={beginResize(edge)} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} />
        ))}
    </section>
  );
}
