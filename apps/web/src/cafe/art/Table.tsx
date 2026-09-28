import type { CloseState, SceneModel } from "@pitwall/world";
import { SCENE } from "../camera";

/** The laptop's bezel; the live desktop sits on its screen (SCENE.screen). */
export const LAPTOP = { x: 596, y: 458, w: 408, h: 302 } as const;
export const PHONE = { x: 1070, y: 750, w: 110, h: 80 } as const;

function Laptop() {
  const s = SCENE.screen;
  return (
    <g className="laptop">
      <rect x={LAPTOP.x} y={LAPTOP.y} width={LAPTOP.w} height={258} rx={10} fill="#111317" />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#0b0d12" />
      <circle cx={LAPTOP.x + LAPTOP.w / 2} cy={LAPTOP.y + 6} r={2} fill="#2a2e35" />
      <path d={`M ${LAPTOP.x - 26} 760 L ${LAPTOP.x} 716 L ${LAPTOP.x + LAPTOP.w} 716 L ${LAPTOP.x + LAPTOP.w + 26} 760 Z`} fill="#b9bec6" />
      <path d={`M ${LAPTOP.x + 150} 760 L ${LAPTOP.x + 160} 750 L ${LAPTOP.x + LAPTOP.w - 160} 750 L ${LAPTOP.x + LAPTOP.w - 150} 760 Z`} fill="#9ea4ad" />
      <rect x={LAPTOP.x - 26} y={758} width={LAPTOP.w + 52} height={6} rx={3} fill="#8d939c" />
    </g>
  );
}

function Cup({ steaming }: { steaming: boolean }) {
  return (
    <g className="cup">
      <ellipse cx={460} cy={800} rx={58} ry={14} fill="#e9e3d8" />
      <path d="M 426 738 L 494 738 L 488 792 Q 460 802 432 792 Z" fill="#f3efe8" />
      <ellipse cx={460} cy={738} rx={34} ry={8} fill="#5e3b26" />
      <path d="M 492 750 q 22 4 0 30" fill="none" stroke="#f3efe8" strokeWidth={7} />
      {steaming &&
        [0, 1, 2].map((i) => (
          <path
            key={i}
            className="particle steam cup-steam"
            d={`M ${446 + i * 14} 728 q -8 -14 0 -28 q 8 -14 0 -28`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.35}
            style={{ animationDelay: `${i * 0.8}s` }}
          />
        ))}
    </g>
  );
}

function Notebook() {
  return (
    <g className="notebook" transform="rotate(-6 320 795)">
      <rect x={240} y={762} width={160} height={70} rx={4} fill="#2f4858" />
      <rect x={250} y={766} width={146} height={62} rx={2} fill="#f6f1e6" />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={260} y1={780 + i * 12} x2={386} y2={780 + i * 12} stroke="#b9c4cc" strokeWidth={1} />
      ))}
      <path d="M 272 790 q 20 -8 40 0 t 40 0" fill="none" stroke="#3b4a5a" strokeWidth={1.5} />
      <rect x={380} y={748} width={6} height={90} rx={3} fill="#c2463a" transform="rotate(28 383 793)" />
    </g>
  );
}

/** Lying flat on the table; while paging it lights up and buzzes (cold-open spec §6). */
function Phone({ ringing, severity, title }: { ringing: boolean; severity: string; title: string }) {
  return (
    <g className={`phone${ringing ? " ringing" : ""}`}>
      {ringing && <ellipse className="phone-glow" cx={1125} cy={792} rx={78} ry={46} fill="#ff7a5c" opacity={0.28} />}
      <g transform="translate(1125 790) rotate(-10) scale(1 0.62)">
        <rect x={-40} y={-74} width={80} height={148} rx={14} fill="#1c1f24" />
        <rect x={-35} y={-66} width={70} height={132} rx={8} fill={ringing ? "#f4f6fa" : "#0e1116"} />
        {ringing && (
          <g fontFamily="IBM Plex Sans, sans-serif" textAnchor="middle">
            <rect x={-30} y={-40} width={60} height={20} rx={4} fill="#c2463a" />
            <text x={0} y={-25} fontSize={13} fontWeight={700} fill="#ffffff">
              {severity}
            </text>
            <text x={0} y={2} fontSize={8.5} fontWeight={600} fill="#1f1a17">
              {title.split(" ").slice(0, 2).join(" ")}
            </text>
            <text x={0} y={14} fontSize={8.5} fontWeight={600} fill="#1f1a17">
              {title.split(" ").slice(2).join(" ")}
            </text>
          </g>
        )}
      </g>
      {ringing && <title>{`${severity} · ${title}`}</title>}
    </g>
  );
}

export function Table({ model, close, ringing, page }: { model: SceneModel; close: CloseState | null; ringing: boolean; page: { severity: string; title: string } }) {
  const { palette } = model;
  return (
    <g className="table layer-near">
      <path d="M 200 900 L 320 700 L 1280 700 L 1400 900 Z" fill={palette.wood} />
      <path d="M 320 700 L 1280 700 L 1286 710 L 314 710 Z" fill={palette.woodDark} opacity={0.6} />
      <Notebook />
      <Cup steaming={close !== "cooled" && close !== "late"} />
      <Laptop />
      <Phone ringing={ringing} severity={page.severity} title={page.title} />
    </g>
  );
}
