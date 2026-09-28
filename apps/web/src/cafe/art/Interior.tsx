import type { Brand, SceneModel } from "@pitwall/world";
import { WINDOW } from "./Street";

/** Scene rectangles other parts of the café (hotspots) line up with. */
export const POSTER = { x: 800, y: 150, w: 100, h: 160 } as const;
export const RADIO = { x: 1250, y: 345, w: 90, h: 55 } as const;
const ESPRESSO = { x: 1060, y: 300, w: 140, h: 100 } as const;
const MENU = { x: 1080, y: 90, w: 300, h: 140 } as const;
const LAMPS = [980, 1180, 1380];

/** The window's frame, and the café's name painted on the glass for the street, so mirrored from inside. */
function WindowFrame({ model }: { model: SceneModel }) {
  const { woodDark } = model.palette;
  return (
    <g className="window-frame">
      <text
        className="glass-sign"
        transform={`translate(${WINDOW.x + WINDOW.w / 2} 160) scale(-1 1)`}
        textAnchor="middle"
        fontFamily="IBM Plex Sans, sans-serif"
        fontSize={34}
        fontWeight={600}
        letterSpacing={2}
        fill="#f3e7cf"
        opacity={0.8}
      >
        {model.sign.name}
      </text>
      <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} fill="none" stroke={woodDark} strokeWidth={14} />
      <rect x={300} y={WINDOW.y} width={10} height={WINDOW.h} fill={woodDark} />
      <rect x={540} y={WINDOW.y} width={10} height={WINDOW.h} fill={woodDark} />
      <rect x={WINDOW.x} y={250} width={WINDOW.w} height={8} fill={woodDark} />
      <rect x={WINDOW.x - 16} y={WINDOW.y + WINDOW.h - 2} width={WINDOW.w + 32} height={14} rx={3} fill={woodDark} />
      {/* A faint reflection across the glass. */}
      <path d={`M ${WINDOW.x + 40} ${WINDOW.y + WINDOW.h} L ${WINDOW.x + 200} ${WINDOW.y} L ${WINDOW.x + 250} ${WINDOW.y} L ${WINDOW.x + 90} ${WINDOW.y + WINDOW.h} Z`} fill="#ffffff" opacity={0.05} />
    </g>
  );
}

function Poster({ brand }: { brand: Brand }) {
  const { x, y, w, h } = POSTER;
  return (
    <g className="poster">
      <rect x={x + 3} y={y + 4} width={w} height={h} fill="#000000" opacity={0.12} />
      <rect x={x} y={y} width={w} height={h} fill={brand.colors.primary} />
      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} fill="none" stroke={brand.colors.paper} strokeWidth={1.5} opacity={0.6} />
      {/* Long brand names shrink to fit the poster's inner frame. */}
      <text x={x + w / 2} y={y + 44} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontSize={Math.min(14, 130 / brand.name.length)} fontWeight={600} fill={brand.colors.paper}>
        {brand.name}
      </text>
      <text x={x + w / 2} y={y + 84} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontSize={11} fontWeight={600} letterSpacing={0.5} fill={brand.colors.paper}>
        FLASH SALE
      </text>
      <text x={x + w / 2} y={y + 124} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontSize={32} fontWeight={700} fill={brand.colors.paper}>
        50%
      </text>
      <circle cx={x + w / 2} cy={y + 2} r={3} fill="#9aa0a6" />
    </g>
  );
}

function MenuBoard({ model }: { model: SceneModel }) {
  const { x, y, w, h } = MENU;
  return (
    <g className="menu-board">
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#23262b" stroke={model.palette.woodDark} strokeWidth={6} />
      <text x={x + w / 2} y={y + 32} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontSize={20} fontWeight={600} fill="#f3e7cf">
        {model.sign.name}
      </text>
      <line x1={x + 30} y1={y + 44} x2={x + w - 30} y2={y + 44} stroke="#f3e7cf" strokeWidth={1} opacity={0.4} />
      {model.sign.menu.map((item, i) => (
        <text key={item} x={x + w / 2} y={y + 72 + i * 24} textAnchor="middle" fontFamily="IBM Plex Sans, sans-serif" fontSize={16} fill="#f3e7cf" opacity={0.9}>
          {item}
        </text>
      ))}
    </g>
  );
}

function Shelves({ model }: { model: SceneModel }) {
  const jars = ["#c9a26b", "#6b4a2f", "#e6d3a3", "#8a5a3b", "#d8c7a4"];
  return (
    <g className="shelves">
      <rect x={1220} y={290} width={360} height={8} fill={model.palette.woodDark} />
      {jars.map((c, i) => (
        <g key={i}>
          <rect x={1236 + i * 64} y={250} width={30} height={40} rx={5} fill={c} opacity={0.9} />
          <rect x={1234 + i * 64} y={246} width={34} height={8} rx={2} fill={model.palette.woodDark} />
        </g>
      ))}
    </g>
  );
}

function Espresso() {
  const { x, y, w, h } = ESPRESSO;
  return (
    <g className="espresso">
      <rect x={x} y={y} width={w} height={h} rx={10} fill="#a9b0b8" />
      <rect x={x + 8} y={y + 8} width={w - 16} height={30} rx={6} fill="#8b929a" />
      <circle cx={x + 34} cy={y + 23} r={7} fill="#e8ecef" />
      <circle cx={x + w - 34} cy={y + 23} r={7} fill="#e8ecef" />
      {[x + 34, x + w - 34].map((px) => (
        <g key={px}>
          <rect x={px - 16} y={y + 48} width={32} height={10} rx={3} fill="#3d4146" />
          <rect x={px - 4} y={y + 58} width={8} height={10} fill="#3d4146" />
          <rect x={px - 10} y={y + 74} width={20} height={20} rx={3} fill="#f3efe8" />
        </g>
      ))}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          className="particle steam espresso-steam"
          d={`M ${x + 30 + i * 40} ${y - 4} q -8 -14 0 -28 q 8 -14 0 -28`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.35}
          style={{ animationDelay: `${i * 0.9}s` }}
        />
      ))}
    </g>
  );
}

function Radio({ on }: { on: boolean }) {
  const { x, y, w, h } = RADIO;
  return (
    <g className={`radio${on ? " playing" : ""}`}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#b0703f" />
      <g className="radio-grille">
        <rect x={x + 8} y={y + 10} width={40} height={36} rx={4} fill="#5a3a22" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={x + 12} y1={y + 17 + i * 8} x2={x + 44} y2={y + 17 + i * 8} stroke="#8a5a3b" strokeWidth={2} />
        ))}
      </g>
      <circle cx={x + 68} cy={y + 22} r={9} fill="#e6d3a3" />
      <line x1={x + 68} y1={y + 22} x2={x + 74} y2={y + 16} stroke="#5a3a22" strokeWidth={2} />
      <circle className={`radio-led${on ? " on" : ""}`} cx={x + 68} cy={y + 42} r={3} fill={on ? "#6bdc7b" : "#4a3a2a"} />
      <line x1={x + w - 12} y1={y} x2={x + w + 10} y2={y - 40} stroke="#555" strokeWidth={2} />
    </g>
  );
}

function Lamps({ model }: { model: SceneModel }) {
  const { lamp, lampGlow } = model.palette;
  return (
    <g className="lamps">
      <defs>
        <radialGradient id="cafe-glow">
          <stop offset="0" stopColor={lamp} stopOpacity={0.9} />
          <stop offset="1" stopColor={lamp} stopOpacity={0} />
        </radialGradient>
      </defs>
      {LAMPS.map((x, i) => (
        <g key={x}>
          <circle className="lamp-glow" cx={x} cy={270} r={150} fill="url(#cafe-glow)" opacity={lampGlow} style={{ animationDelay: `${i * 1.7}s` }} />
          <line x1={x} y1={0} x2={x} y2={236} stroke="#2a2320" strokeWidth={2} />
          <path d={`M ${x - 34} 270 L ${x - 14} 236 L ${x + 14} 236 L ${x + 34} 270 Z`} fill="#2f3a2f" />
          <ellipse cx={x} cy={271} rx={20} ry={5} fill={lamp} />
        </g>
      ))}
    </g>
  );
}

export function Interior({ model, brand, radioOn }: { model: SceneModel; brand: Brand; radioOn: boolean }) {
  const { palette } = model;
  return (
    <>
      <WindowFrame model={model} />
      <g className="interior layer-mid">
        <rect x={0} y={520} width={1600} height={100} fill={palette.wallShade} />
        <rect x={0} y={516} width={1600} height={6} fill={palette.woodDark} opacity={0.8} />
        <Poster brand={brand} />
        <MenuBoard model={model} />
        <Shelves model={model} />
        <rect x={0} y={620} width={1600} height={280} fill={palette.floor} />
        {[660, 710, 770, 840].map((y) => (
          <line key={y} x1={0} y1={y} x2={1600} y2={y} stroke="#000000" strokeWidth={2} opacity={0.08} />
        ))}
        <rect x={900} y={400} width={700} height={220} fill={palette.counter} />
        <rect x={890} y={396} width={710} height={22} rx={3} fill={palette.wood} />
        {[980, 1120, 1260, 1400, 1540].map((x) => (
          <rect key={x} x={x} y={430} width={4} height={180} fill="#000000" opacity={0.15} />
        ))}
        <Espresso />
        <Radio on={radioOn} />
        <Lamps model={model} />
      </g>
    </>
  );
}
