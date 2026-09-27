import { useRef, type Dispatch, type PointerEvent, type ReactNode } from "react";
import { Glyph } from "../brand/Glyph";
import { frameOf, type WindowState, type WmAction } from "../wm/wm";

interface Props {
  win: WindowState;
  area: { w: number; h: number };
  focused: boolean;
  dispatch: Dispatch<WmAction>;
  children: ReactNode;
}

type Drag = { kind: "move" | "resize"; px: number; py: number; x: number; y: number; w: number; h: number };

export function Window({ win, area, focused, dispatch, children }: Props) {
  const frame = frameOf(win, area);
  const drag = useRef<Drag | null>(null);
  const maximized = win.mode === "maximized";

  const begin = (kind: Drag["kind"]) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { kind, px: e.clientX, py: e.clientY, ...frame };
  };
  const onMove = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (d.kind === "move") dispatch({ type: "move", id: win.id, x: d.x + dx, y: d.y + dy });
    else dispatch({ type: "resize", id: win.id, w: d.w + dx, h: d.h + dy });
  };
  const end = () => {
    drag.current = null;
  };

  return (
    <section
      className={`window${focused ? " focused" : ""}${win.mode !== "normal" ? ` ${win.mode}` : ""}`}
      style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h, zIndex: win.z }}
      aria-label={win.title}
      hidden={win.minimized}
      onPointerDownCapture={() => {
        if (!focused) dispatch({ type: "focus", id: win.id });
      }}
    >
      <header
        className="titlebar"
        onPointerDown={begin("move")}
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
      {!maximized && (
        <div className="resize-handle" aria-hidden="true" onPointerDown={begin("resize")} onPointerMove={onMove} onPointerUp={end} onPointerCancel={end} />
      )}
    </section>
  );
}
