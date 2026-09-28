import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { GlossaryEntry, GlossaryId } from "../content/glossary";

const TIP_W = 260;

type Glossary = typeof import("../content/glossary");
let glossary: Glossary | null = null;
let loading: Promise<Glossary> | null = null;

/** The definitions load apart from the main chunk (M2.5 plan budgets), as soon as a term shows. */
function useEntry(id: GlossaryId): GlossaryEntry | null {
  const [loaded, setLoaded] = useState(glossary);
  useEffect(() => {
    if (loaded) return;
    let live = true;
    loading ??= import("../content/glossary").then((m) => (glossary = m));
    void loading.then((m) => live && setLoaded(m));
    return () => {
      live = false;
    };
  }, [loaded]);
  return loaded?.glossaryEntry(id) ?? null;
}

/**
 * A glossary word in context (M2.5 spec §4): a dotted underline, and the plain-language definition
 * in a tooltip on hover or keyboard focus. Esc dismisses it (WCAG 1.4.13). The tooltip sits in
 * <body>, so a panel's overflow never clips it, and it stays out of the surrounding text.
 */
export function Term({ id, children }: { id: GlossaryId; children: ReactNode }) {
  const entry = useEntry(id);
  const tipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<CSSProperties | null>(null);

  const show = () => {
    const r = ref.current!.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - TIP_W - 8)), maxWidth: TIP_W });
  };
  const hide = () => setPos(null);

  return (
    <>
      <span
        ref={ref}
        className="term"
        tabIndex={0}
        aria-describedby={tipId}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onKeyDown={(e) => {
          if (e.key === "Escape" && pos) {
            e.stopPropagation();
            hide();
          }
        }}
      >
        {children}
      </span>
      {createPortal(
        <span role="tooltip" id={tipId} className="term-tip" hidden={!pos || !entry} style={pos ?? undefined}>
          {entry?.definition}
        </span>,
        document.body,
      )}
    </>
  );
}
