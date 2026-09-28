import type { Brand, SceneModel } from "@pitwall/world";
import { memo } from "react";
import { Books, darken, FONT, Frame, Jar, lighten, Plant, Prop, rnd, toner } from "./kit";
import { WINDOW } from "./Street";

export { RADIO } from "./Counter";

/** Scene rectangles other parts of the café (hotspots) line up with. */
export const POSTER = { x: 800, y: 150, w: 100, h: 160 } as const;
/** Easter eggs on the wall (M2.5 spec §12): buttons, never clues. */
export const CLOCK_3AM = { x: 852, y: 70, w: 50, h: 76 } as const;
export const HUG_OPS = { x: 908, y: 68, w: 84, h: 124 } as const;
export const DAYS_SIGN = { x: 1000, y: 68, w: 72, h: 88 } as const;
const MENU = { x: 1080, y: 70, w: 300, h: 150 } as const;
const SHELF_Y = 238;

type Tone = ReturnType<typeof toner>;

/** The back wall, with a hole where the window is, in the city's material and lit from above. */
function WallSurface({ model, t }: { model: SceneModel; t: Tone }) {
  const hole = `M ${WINDOW.x} ${WINDOW.y} V ${WINDOW.y + WINDOW.h} H ${WINDOW.x + WINDOW.w} V ${WINDOW.y} Z`;
  const outer = "M -40 -40 H 1640 V 640 H -40 Z";
  const style = model.sign.decor.style;
  return (
    <Prop name="back-wall">
      <path d={`${outer} ${hole}`} fillRule="evenodd" fill="url(#cf-wall-tex)" />
      {/* Shadow gathers under the ceiling; a band, not a full-wall overlay, to keep overdraw low. */}
      <rect x={-40} y={-40} width={1680} height={200} fill="url(#cf-ceiling-shadow)" />
      {style === "kissaten" && <rect x={-40} y={40} width={1680} height={10} fill="url(#cf-trim-v)" />}
      {/* Below the window: a panelled dado. */}
      <rect x={-40} y={WINDOW.y + WINDOW.h} width={960} height={110} fill={t(darken(model.sign.decor.wall[1], 0.2))} />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={-30 + i * 80} y={WINDOW.y + WINDOW.h + 12} width={68} height={86} rx={3} fill="none" stroke={t(darken(model.sign.decor.wall[1], 0.4))} strokeWidth={3} />
      ))}
      <rect x={-40} y={WINDOW.y + WINDOW.h} width={960} height={110} fill="url(#cf-counter)" />
    </Prop>
  );
}

function Ceiling({ model, t }: { model: SceneModel; t: Tone }) {
  const d = model.sign.decor;
  const style = d.style;
  return (
    <Prop name="ceiling">
      <rect x={-40} y={-40} width={1680} height={88} fill={t(darken(d.wall[1], 0.45))} />
      <rect x={-40} y={-40} width={1680} height={88} fill="url(#cf-counter)" opacity={0.6} />
      {/* Boards overhead, a strip of shadow where the ceiling meets the wall, speakers and a sprinkler or two. */}
      {Array.from({ length: 56 }, (_, i) => (
        <rect key={`b${i}`} x={-40 + i * 31} y={-40} width={1.5} height={88} fill="#000000" opacity={0.25} />
      ))}
      {Array.from({ length: 56 }, (_, i) => (
        <rect key={`h${i}`} x={-38 + i * 31} y={-40} width={1} height={88} fill="#ffffff" opacity={0.05} />
      ))}
      <rect x={-40} y={40} width={1680} height={10} fill="#000000" opacity={0.3} />
      {[330, 1030].map((x) => (
        <g key={x}>
          <rect x={x} y={8} width={34} height={24} rx={4} fill={t("#2a2d33")} />
          <rect x={x + 4} y={12} width={26} height={16} rx={3} fill={t("#3d4146")} />
          {[0, 1, 2].map((k) => (
            <line key={k} x1={x + 7} y1={16 + k * 4} x2={x + 27} y2={16 + k * 4} stroke="#000000" strokeOpacity={0.4} />
          ))}
        </g>
      ))}
      {[560, 1300].map((x) => (
        <g key={x}>
          <rect x={x - 1} y={30} width={2} height={10} fill={t("#9aa0a6")} />
          <circle cx={x} cy={42} r={4} fill={t("#c9ced4")} />
        </g>
      ))}
      {style === "laneway" && (
        <g>
          <rect x={-40} y={20} width={1680} height={12} rx={6} fill="url(#cf-chrome)" opacity={0.7} />
          {[200, 700, 1200].map((x) => (
            <rect key={x} x={x} y={14} width={14} height={24} rx={3} fill={t("#5a5f66")} />
          ))}
        </g>
      )}
      {style === "kissaten" &&
        Array.from({ length: 14 }, (_, i) => (
          <g key={i}>
            <rect x={-40 + i * 124} y={-40} width={30} height={84} fill={t(d.trim)} />
            <rect x={-40 + i * 124} y={-40} width={6} height={84} fill="#ffffff" opacity={0.06} />
          </g>
        ))}
      {style === "kopi" && (
        <g>
          <rect x={-40} y={6} width={1680} height={30} rx={15} fill="url(#cf-chrome)" opacity={0.55} />
          {Array.from({ length: 18 }, (_, i) => (
            <rect key={i} x={-40 + i * 100} y={6} width={3} height={30} fill="#000000" opacity={0.2} />
          ))}
        </g>
      )}
      {style === "joglo" && (
        <g>
          {[0, 1, 2].map((k) => (
            <g key={k}>
              <rect x={-40 + k * 30} y={-8 + k * 16} width={1680 - k * 60} height={14} fill={t(lighten(d.trim, 0.2 + k * 0.08))} />
              <rect x={-40 + k * 30} y={-8 + k * 16} width={1680 - k * 60} height={3} fill="#ffffff" opacity={0.12} />
              {Array.from({ length: 40 }, (_, i) => (
                <path key={i} d={`M ${-30 + k * 30 + i * 42} ${-1 + k * 16} q 5 -5 10 0 t 10 0`} fill="none" stroke={t(d.trim)} strokeWidth={1.2} opacity={0.7} />
              ))}
            </g>
          ))}
        </g>
      )}
    </Prop>
  );
}

/** Fairy lights strung across the room in slow swags; a few twinkle. */
function StringLights({ model }: { model: SceneModel }) {
  const lit = model.time !== "afternoon";
  const swags: [number, number, number][] = [
    [-20, 400, 96],
    [400, 820, 104],
    [820, 1240, 92],
    [1240, 1640, 100],
  ];
  return (
    <Prop name="string-lights">
      {swags.map(([a, b, sag], k) => {
        const n = 11;
        return (
          <g key={k}>
            <path d={`M ${a} 50 Q ${(a + b) / 2} ${sag + 40} ${b} 50`} fill="none" stroke="#2a2320" strokeWidth={1.4} />
            {Array.from({ length: n }, (_, i) => {
              const u = (i + 0.5) / n;
              const x = (1 - u) * (1 - u) * a + 2 * u * (1 - u) * ((a + b) / 2) + u * u * b;
              const y = (1 - u) * (1 - u) * 50 + 2 * u * (1 - u) * (sag + 40) + u * u * 50;
              const tw = (i + k) % 4 === 0;
              return (
                <g key={i}>
                  <rect x={x - 1.5} y={y} width={3} height={4} fill="#2a2320" />
                  {lit && <circle className={tw ? "particle twinkle" : undefined} cx={x} cy={y + 8} r={9} fill="url(#cf-bokeh-warm)" opacity={0.8} style={tw ? { animationDelay: `${-rnd(i + k * 11) * 3}s` } : undefined} />}
                  <ellipse cx={x} cy={y + 8} rx={2.6} ry={3.6} fill={lit ? "#fff0c0" : "#e8e2d4"} />
                </g>
              );
            })}
          </g>
        );
      })}
    </Prop>
  );
}

/** The city's clock beside a second one that has read 3:00 ever since the disk filled up. */
function Clocks({ model, t, hhmm, cityName }: { model: SceneModel; t: Tone; hhmm: string; cityName: string }) {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  const face = (cx: number, cy: number, r: number, hour: number, minute: number) => (
    <g>
      <circle cx={cx + 2} cy={cy + 3} r={r + 3} fill="#000000" opacity={0.25} />
      <circle cx={cx} cy={cy} r={r + 3} fill={t(model.sign.decor.trim)} />
      <circle cx={cx} cy={cy} r={r} fill={t("#f6f1e6")} />
      <circle cx={cx - r * 0.3} cy={cy - r * 0.3} r={r * 0.6} fill="#ffffff" opacity={0.25} />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return <line key={i} x1={cx + Math.sin(a) * r * 0.8} y1={cy - Math.cos(a) * r * 0.8} x2={cx + Math.sin(a) * r * 0.92} y2={cy - Math.cos(a) * r * 0.92} stroke="#1f1a17" strokeWidth={i % 3 ? 1 : 2} />;
      })}
      <line x1={cx} y1={cy} x2={cx + Math.sin(((hour % 12) + minute / 60) * (Math.PI / 6)) * r * 0.5} y2={cy - Math.cos(((hour % 12) + minute / 60) * (Math.PI / 6)) * r * 0.5} stroke="#1f1a17" strokeWidth={2.6} strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={cx + Math.sin(minute * (Math.PI / 30)) * r * 0.78} y2={cy - Math.cos(minute * (Math.PI / 30)) * r * 0.78} stroke="#1f1a17" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={2} fill="#c2463a" />
    </g>
  );
  return (
    <>
      <Prop name="clock-city">
        {face(822, 100, 22, h, m)}
        <rect x={798} y={128} width={48} height={12} rx={2} fill={t(model.sign.decor.trim)} />
        <text x={822} y={137} textAnchor="middle" fontFamily={FONT} fontSize={cityName.length > 9 ? 6 : 7} fontWeight={700} letterSpacing={0.6} fill="#f3e7cf">
          {cityName.toUpperCase()}
        </text>
      </Prop>
      <Prop name="clock-3am">
        {face(877, 98, 20, 3, 0)}
        <rect x={861} y={124} width={32} height={20} fill="#f7e27a" transform="rotate(-5 877 134)" />
        <text x={877} y={133} textAnchor="middle" fontFamily={FONT} fontSize={5.4} fontWeight={600} fill="#1f1a17" transform="rotate(-5 877 134)">
          DISK FULL
        </text>
        <text x={877} y={140} textAnchor="middle" fontFamily={FONT} fontSize={5.4} fontWeight={600} fill="#1f1a17" transform="rotate(-5 877 134)">
          AT 3AM?
        </text>
      </Prop>
    </>
  );
}

function Poster({ brand, t }: { brand: Brand; t: Tone }) {
  const { x, y, w, h } = POSTER;
  return (
    <Prop name="brand-poster" className="poster">
      <rect x={x + 4} y={y + 6} width={w} height={h} fill="#000000" opacity={0.25} />
      <rect x={x} y={y} width={w} height={h} fill={t(brand.colors.primary)} />
      <rect x={x} y={y} width={w} height={h * 0.5} fill="#ffffff" opacity={0.08} />
      <rect x={x + 8} y={y + 8} width={w - 16} height={h - 16} fill="none" stroke={brand.colors.paper} strokeWidth={1.5} opacity={0.6} />
      {/* Long brand names shrink to fit the poster's inner frame. */}
      <text x={x + w / 2} y={y + 44} textAnchor="middle" fontFamily={FONT} fontSize={Math.min(14, 130 / brand.name.length)} fontWeight={600} fill={brand.colors.paper}>
        {brand.name}
      </text>
      <text x={x + w / 2} y={y + 84} textAnchor="middle" fontFamily={FONT} fontSize={11} fontWeight={600} letterSpacing={0.5} fill={brand.colors.paper}>
        FLASH SALE
      </text>
      <text x={x + w / 2} y={y + 124} textAnchor="middle" fontFamily={FONT} fontSize={32} fontWeight={700} fill={brand.colors.paper}>
        50%
      </text>
      <path d={`M ${x + w - 18} ${y} L ${x + w} ${y} L ${x + w} ${y + 18} Z`} fill="#000000" opacity={0.2} />
      <circle cx={x + w / 2} cy={y + 3} r={3} fill="#9aa0a6" />
    </Prop>
  );
}

function HugOps({ t }: { t: Tone }) {
  const { x, y, w, h } = HUG_OPS;
  return (
    <Prop name="hug-ops">
      <rect x={x + 4} y={y + 6} width={w} height={h} fill="#000000" opacity={0.25} />
      <rect x={x} y={y} width={w} height={h} fill={t("#f4d9c6")} />
      <rect x={x} y={y + h * 0.55} width={w} height={h * 0.45} fill={t("#e8a58c")} />
      <path d={`M ${x + w / 2} ${y + 70} C ${x + 4} ${y + 40} ${x + 22} ${y + 12} ${x + w / 2} ${y + 32} C ${x + w - 22} ${y + 12} ${x + w - 4} ${y + 40} ${x + w / 2} ${y + 70} Z`} fill={t("#d8434e")} />
      <path d={`M ${x + 24} ${y + 40} q 8 -10 18 -2`} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <text x={x + w / 2} y={y + 94} textAnchor="middle" fontFamily={FONT} fontSize={17} fontWeight={800} letterSpacing={1} fill={t("#2a1a24")}>
        HUG OPS
      </text>
      <text x={x + w / 2} y={y + 108} textAnchor="middle" fontFamily={FONT} fontSize={6.5} fontWeight={600} fill={t("#2a1a24")}>
        they were up at 3 AM
      </text>
      <rect x={x + w / 2 - 12} y={y - 3} width={24} height={7} fill="#e8e2c4" opacity={0.8} transform={`rotate(-4 ${x + w / 2} ${y})`} />
    </Prop>
  );
}

/** "Days since last incident": a seeded count, flipped to 0 the moment the page fires. */
function DaysSince({ days, paged, t }: { days: number; paged: boolean; t: Tone }) {
  const { x, y, w, h } = DAYS_SIGN;
  return (
    <Prop name="days-since">
      <rect x={x + 3} y={y + 5} width={w} height={h} rx={3} fill="#000000" opacity={0.25} />
      <rect x={x} y={y} width={w} height={h} rx={3} fill={t("#f3efe6")} />
      <rect x={x} y={y} width={w} height={16} rx={3} fill={t("#2f6b3f")} />
      <text x={x + w / 2} y={y + 11} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={700} letterSpacing={0.6} fill="#ffffff">
        SAFETY FIRST
      </text>
      <rect x={x + 16} y={y + 22} width={40} height={34} rx={3} fill={t("#1f1c1a")} />
      <line x1={x + 16} y1={y + 39} x2={x + 56} y2={y + 39} stroke="#000000" strokeWidth={1.2} />
      <text className="days" x={x + w / 2} y={y + 49} textAnchor="middle" fontFamily={FONT} fontSize={24} fontWeight={700} fill={paged ? "#ff6b5a" : "#f3efe6"}>
        {paged ? 0 : days}
      </text>
      <text x={x + w / 2} y={y + 68} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={700} fill={t("#1f1a17")}>
        DAYS SINCE LAST
      </text>
      <text x={x + w / 2} y={y + 78} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={700} fill={t("#1f1a17")}>
        INCIDENT
      </text>
    </Prop>
  );
}

/** The Wi-Fi card by the window, a light switch, and a small shelf with a plant, under the poster. */
function WifiCorner({ model, t }: { model: SceneModel; t: Tone }) {
  const slug = model.sign.name.toLowerCase().replace(/[^a-z]+/g, "") || "kissa";
  return (
    <>
      <Prop name="wifi-card">
        <rect x={781} y={329} width={86} height={50} rx={3} fill="#000000" opacity={0.25} />
        <rect x={778} y={326} width={86} height={50} rx={3} fill={t("#f6f1e6")} />
        <rect x={778} y={326} width={86} height={12} rx={3} fill={t(model.sign.decor.accent)} />
        <text x={821} y={335} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={700} fill="#ffffff">
          FREE WI-FI
        </text>
        <text x={784} y={350} fontFamily={FONT} fontSize={6.5} fill={t("#1f1a17")}>
          {`net: ${slug}`}
        </text>
        <text x={784} y={360} fontFamily={FONT} fontSize={6.5} fill={t("#1f1a17")}>
          pw: turnitoffandon
        </text>
        <text x={784} y={370} fontFamily={FONT} fontSize={6.5} fill={t("#1f1a17")}>
          again
        </text>
      </Prop>
      <Prop name="light-switch">
        <rect x={786} y={392} width={16} height={24} rx={2} fill={t("#e8e2d4")} />
        <rect x={791} y={398} width={6} height={10} rx={1} fill={t("#c9c0ae")} />
      </Prop>
      <Prop name="wall-planter">
        <rect x={812} y={420} width={60} height={5} fill="url(#cf-trim-v)" />
        <Plant x={842} y={404} s={0.75} pot={t("#c9785a")} leaf={t("#5a9a6a")} kind="trail" seed={61} />
      </Prop>
    </>
  );
}

/** Small framed prints around the posters: a line drawing of the city, a cup, a plant. */
function Prints({ model, t }: { model: SceneModel; t: Tone }) {
  const frame = t(model.sign.decor.trim);
  const accent = t(model.sign.decor.accent);
  return (
    <>
      <Prop name="print-city">
        <Frame x={908} y={206} w={52} h={66} frame={frame} mat={t("#efe6d4")}>
          <path d="M 914 262 L 922 236 L 928 248 L 936 226 L 944 250 L 954 240 L 954 262 Z" fill={accent} opacity={0.8} />
          <circle cx={944} cy={224} r={5} fill={t("#e0a43a")} />
        </Frame>
      </Prop>
      <Prop name="print-cup">
        <Frame x={968} y={214} w={44} h={44} frame={t("#c9a26b")} mat={t("#f6f1e6")}>
          <path d="M 978 238 h 20 v 8 q -10 6 -20 0 Z" fill={t("#5e3b26")} />
          <path d="M 998 240 q 6 1 0 5" fill="none" stroke={t("#5e3b26")} strokeWidth={2} />
          <path d="M 984 232 q -3 -4 0 -8 M 990 232 q -3 -4 0 -8" fill="none" stroke={t("#5e3b26")} strokeWidth={1.4} />
        </Frame>
      </Prop>
      <Prop name="print-botanical">
        <Frame x={1016} y={176} w={50} h={56} frame={frame} mat={t("#e8efe0")}>
          <path d="M 1041 226 Q 1040 200 1041 186" stroke={t("#3b7d4f")} strokeWidth={1.6} />
          {[0, 1, 2, 3].map((i) => (
            <ellipse key={i} cx={1041 + (i % 2 ? 7 : -7)} cy={192 + i * 8} rx={7} ry={3} fill={t("#5a9a6a")} transform={`rotate(${i % 2 ? -30 : 30} ${1041 + (i % 2 ? 7 : -7)} ${192 + i * 8})`} />
          ))}
        </Frame>
      </Prop>
    </>
  );
}

function MenuBoard({ model, t }: { model: SceneModel; t: Tone }) {
  const { x, y, w, h } = MENU;
  const d = model.sign.decor;
  const chalk = "#f3efe6";
  return (
    <Prop name="chalkboard-menu" className="menu-board">
      <rect x={x + 5} y={y + 7} width={w} height={h} rx={6} fill="#000000" opacity={0.3} />
      <rect x={x} y={y} width={w} height={h} rx={6} fill={t("#2a302c")} stroke={t(d.trim)} strokeWidth={7} />
      {Array.from({ length: 6 }, (_, i) => (
        <ellipse key={i} cx={x + 30 + rnd(i) * (w - 60)} cy={y + 20 + rnd(i + 3) * (h - 40)} rx={30 + rnd(i + 7) * 30} ry={10 + rnd(i + 1) * 10} fill="#ffffff" opacity={0.035} />
      ))}
      <text x={x + w / 2} y={y + 30} textAnchor="middle" fontFamily={FONT} fontSize={19} fontWeight={600} fill={chalk}>
        {model.sign.name}
      </text>
      <path d={`M ${x + 40} ${y + 40} q ${(w - 80) / 2} 6 ${w - 80} 0`} fill="none" stroke={chalk} strokeWidth={1} opacity={0.5} />
      {[...model.sign.menu, ...d.specials].map((item, i) => (
        <text key={item} x={x + 24} y={y + 60 + i * 17} fontFamily={FONT} fontSize={13} fontStyle={i >= 3 ? "italic" : undefined} fill={i >= 3 ? "#f7d67a" : chalk} opacity={0.9}>
          {item}
        </text>
      ))}
      {/* A chalk doodle of a steaming cup. */}
      <g transform={`translate(${x + w - 62} ${y + 92})`} fill="none" stroke={chalk} strokeWidth={1.6} opacity={0.75}>
        <path d="M 0 0 h 34 v 16 q -17 14 -34 0 Z" />
        <path d="M 34 4 q 10 2 0 12" />
        <path d="M 10 -6 q -4 -6 0 -12 M 20 -6 q -4 -6 0 -12" />
        <path d="M -6 34 q 23 6 46 0" />
      </g>
      <rect x={x + w - 60} y={y + h - 8} width={20} height={4} rx={2} fill={chalk} opacity={0.8} />
    </Prop>
  );
}

/** The shelf under the menu: jars, records, books and a trailing plant; the city decides the rest. */
function MenuShelf({ model, t }: { model: SceneModel; t: Tone }) {
  const d = model.sign.decor;
  const style = d.style;
  return (
    <>
      <Prop name="menu-shelf">
        <rect x={1070} y={SHELF_Y} width={330} height={8} fill="url(#cf-trim-v)" />
        <rect x={1070} y={SHELF_Y + 8} width={330} height={4} fill="#000000" opacity={0.25} />
        {[1090, 1380].map((x) => (
          <path key={x} d={`M ${x} ${SHELF_Y + 8} l 0 14 l -10 0`} fill="none" stroke={t(d.trim)} strokeWidth={3} />
        ))}
      </Prop>
      <Prop name="bean-jars">
        <Jar x={1078} y={SHELF_Y} fill={t(style === "kopi" ? "#6b3f1e" : "#4a2e1c")} lid={t(d.trim)} />
        <Jar x={1104} y={SHELF_Y} w={20} h={24} fill={t(style === "kopi" || style === "joglo" ? "#a0652a" : "#c9a26b")} lid={t(d.trim)} />
        <Jar x={1128} y={SHELF_Y} w={18} h={34} fill={t("#e6d3a3")} lid={t(d.trim)} />
      </Prop>
      <Prop name="records">
        {[0, 1, 2, 3].map((i) => (
          <g key={i} transform={`rotate(${-8 + i * 3} ${1160 + i * 6} ${SHELF_Y})`}>
            <rect x={1152 + i * 6} y={SHELF_Y - 40} width={40} height={40} fill={t(["#c2463a", "#2f4858", "#e0a43a", "#6b8f71"][i]!)} />
            <circle cx={1172 + i * 6} cy={SHELF_Y - 20} r={11} fill={t("#1f1c1a")} opacity={i === 3 ? 1 : 0} />
            <rect x={1152 + i * 6} y={SHELF_Y - 40} width={3} height={40} fill="#ffffff" opacity={0.18} />
          </g>
        ))}
      </Prop>
      <Prop name="shelf-books">
        <Books x={1222} y={SHELF_Y} w={62} seed={3} colors={[t("#2f4858"), t("#c2463a"), t("#e6d3a3"), t("#6b8f71"), t("#8a5a3b")]} />
      </Prop>
      <Prop name="trailing-plant">
        <Plant x={1306} y={SHELF_Y - 16} s={0.9} pot={t("#c9785a")} leaf={t("#4f8a5a")} kind="trail" seed={4} />
      </Prop>
      {style === "kissaten" && (
        <Prop name="cup-collection">
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <ellipse cx={1344 + i * 14} cy={SHELF_Y - 2} rx={7} ry={2} fill={t("#e8e0cc")} />
              <path d={`M ${1338 + i * 14} ${SHELF_Y - 14} h 12 l -1 11 h -10 z`} fill={t(["#2f4858", "#e8e0cc", "#9e2b31", "#c9a26b"][i]!)} />
            </g>
          ))}
        </Prop>
      )}
      {style === "kopi" && (
        <Prop name="gula-aren-bottles">
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={1340 + i * 18} y={SHELF_Y - 34} width={14} height={34} rx={3} fill={t("#6b3f1e")} opacity={0.9} />
              <rect x={1343 + i * 18} y={SHELF_Y - 42} width={8} height={9} fill={t("#2a2d33")} />
              <rect x={1340 + i * 18} y={SHELF_Y - 22} width={14} height={9} fill={t("#f3e7cf")} />
            </g>
          ))}
        </Prop>
      )}
      {style === "joglo" && (
        <Prop name="kendi-jug">
          <ellipse cx={1356} cy={SHELF_Y - 14} rx={14} ry={14} fill={t("#b8643a")} />
          <rect x={1351} y={SHELF_Y - 36} width={10} height={10} fill={t("#b8643a")} />
          <path d={`M 1368 ${SHELF_Y - 18} l 12 -8`} stroke={t("#b8643a")} strokeWidth={4} />
          <ellipse cx={1350} cy={SHELF_Y - 18} rx={4} ry={6} fill="#ffffff" opacity={0.2} />
        </Prop>
      )}
      {style === "laneway" && (
        <Prop name="bike-wheel-art">
          <circle cx={1356} cy={SHELF_Y - 26} r={20} fill="none" stroke={t("#1f1c1a")} strokeWidth={3} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <line key={i} x1={1356} y1={SHELF_Y - 26} x2={1356 + Math.cos(i) * 20} y2={SHELF_Y - 26 + Math.sin(i) * 20} stroke={t("#9aa0a6")} strokeWidth={1} />
          ))}
        </Prop>
      )}
    </>
  );
}

/** The tall shelves at the far right, and what each city keeps on them. */
function TallShelves({ model, t }: { model: SceneModel; t: Tone }) {
  const d = model.sign.decor;
  const levels = [118, 196, 274, 352];
  const books = [t("#2f4858"), t("#c2463a"), t("#e6d3a3"), t("#6b8f71"), t("#8a5a3b"), t("#3b6ea5")];
  return (
    <>
      <Prop name="tall-shelves">
        <rect x={1404} y={50} width={200} height={350} fill={t(darken(d.wall[1], 0.35))} />
        <rect x={1404} y={50} width={200} height={350} fill="url(#cf-counter)" opacity={0.5} />
        {levels.map((y) => (
          <g key={y}>
            <rect x={1400} y={y} width={210} height={8} fill="url(#cf-trim-v)" />
            <rect x={1400} y={y + 8} width={210} height={5} fill="#000000" opacity={0.3} />
          </g>
        ))}
        <rect x={1400} y={50} width={8} height={350} fill="url(#cf-trim)" />
      </Prop>
      <Prop name="shelf-books-tall">
        <Books x={1414} y={levels[0]!} w={96} seed={11} colors={books} />
        <Books x={1500} y={levels[2]!} w={90} seed={17} colors={books} />
      </Prop>
      <Prop name="shelf-plants">
        <Plant x={1540} y={levels[0]! - 16} s={0.9} pot={t("#e6d3a3")} leaf={t("#5a9a6a")} kind="round" seed={21} />
        <Plant x={1440} y={levels[3]! - 16} s={1} pot={t("#c9785a")} leaf={t("#4f8a5a")} kind="snake" seed={5} />
        <Plant x={1576} y={levels[1]! - 14} s={0.8} pot={t("#3a3f47")} leaf={t("#6aa87a")} kind="trail" seed={8} />
      </Prop>
      <Prop name="shelf-jars">
        <Jar x={1420} y={levels[1]!} fill={t("#c9a26b")} lid={t(d.trim)} />
        <Jar x={1446} y={levels[1]!} w={20} h={24} fill={t("#8a5a3b")} lid={t(d.trim)} />
        <Jar x={1470} y={levels[1]!} w={26} h={34} fill={t("#e6d3a3")} lid={t(d.trim)} />
        <Jar x={1520} y={levels[3]!} w={24} h={28} fill={t("#b86a4a")} lid={t(d.trim)} />
      </Prop>
      <Prop name="shelf-records">
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={1418 + i * 7} y={levels[2]! - 44} width={5} height={44} fill={t(["#1f1c1a", "#c2463a", "#e0a43a", "#2f4858", "#f3efe6"][i]!)} />
        ))}
        <circle cx={1476} cy={levels[2]! - 22} r={20} fill={t("#1f1c1a")} />
        <circle cx={1476} cy={levels[2]! - 22} r={7} fill={t("#e0a43a")} />
      </Prop>
      {d.style === "joglo" && (
        <Prop name="batik-cloth">
          <rect x={1410} y={130} width={120} height={60} fill={t(d.accent)} />
          <rect x={1410} y={130} width={120} height={60} fill="url(#cf-batik)" />
        </Prop>
      )}
    </>
  );
}

/** Things the left wall holds, seen only on wide screens: coats, a hanging plant, a mirror. */
function LeftWall({ t, model }: { t: Tone; model: SceneModel }) {
  return (
    <Prop name="coat-hooks">
      <rect x={-10} y={300} width={80} height={8} fill="url(#cf-trim-v)" />
      {[6, 34, 60].map((x) => (
        <circle key={x} cx={x} cy={312} r={3} fill={t("#9aa0a6")} />
      ))}
      <path d="M 0 312 Q -10 360 -4 420 L 24 420 Q 22 360 8 312 Z" fill={t("#6b4a3a")} />
      <path d="M 30 312 Q 20 350 26 400 L 52 400 Q 50 350 38 312 Z" fill={t(model.sign.decor.accent)} />
      <path d="M 58 312 q 10 20 2 40" fill="none" stroke={t("#c2463a")} strokeWidth={5} />
      <Plant x={30} y={190} s={1.1} pot={t("#e6d3a3")} leaf={t("#5a9a6a")} kind="trail" seed={13} />
      <line x1={30} y1={48} x2={30} y2={180} stroke="#2a2320" strokeWidth={1.4} />
    </Prop>
  );
}

/** The style's signature piece on the wall: neon for the kopi bar, a wayang for the joglo, a pendulum for the kissaten, a street-art print for the laneway. */
function Signature({ model, t }: { model: SceneModel; t: Tone }) {
  const d = model.sign.decor;
  if (d.style === "kopi") {
    const on = model.time !== "afternoon";
    return (
      <Prop name="neon-sign">
        <g className="neon" opacity={on ? 1 : 0.55}>
          <path d="M 1420 70 q 10 -20 20 0 q 10 20 20 0 M 1470 60 v 24 M 1470 72 l 14 -12 M 1470 72 l 14 12" fill="none" stroke={d.accent} strokeWidth={4} strokeLinecap="round" />
          <text x={1500} y={86} fontFamily={FONT} fontSize={24} fontStyle="italic" fontWeight={600} fill="none" stroke={d.glow} strokeWidth={2}>
            kopi
          </text>
          {on && <ellipse cx={1500} cy={76} rx={100} ry={36} fill="url(#cf-bokeh-accent)" opacity={0.5} />}
        </g>
      </Prop>
    );
  }
  if (d.style === "joglo") {
    return (
      <Prop name="wayang">
        <g transform="translate(1560 210)" fill={t("#3a2414")}>
          <path d="M 0 -60 q 14 6 10 22 q 16 10 8 40 l -6 40 l -10 0 l -2 -40 q -14 -8 -10 -30 q -4 -20 10 -32 Z" />
          <path d="M 4 -20 q 30 20 20 60 M 0 -14 q -24 30 -10 54" fill="none" stroke={t("#3a2414")} strokeWidth={2} />
          <line x1={2} y1={40} x2={2} y2={90} stroke={t("#8a5a3b")} strokeWidth={3} />
          <circle cx={4} cy={-40} r={2} fill={t("#e0a43a")} />
        </g>
      </Prop>
    );
  }
  if (d.style === "kissaten") {
    return (
      <Prop name="pendulum-clock">
        <rect x={1534} y={130} width={50} height={120} rx={4} fill={t(d.trim)} />
        <circle cx={1559} cy={154} r={17} fill={t("#f3e7cf")} />
        <line x1={1559} y1={154} x2={1559} y2={142} stroke="#1f1a17" strokeWidth={2} />
        <line x1={1559} y1={154} x2={1568} y2={154} stroke="#1f1a17" strokeWidth={1.5} />
        <rect x={1542} y={176} width={34} height={66} fill={t("#1f1410")} />
        <g className="pendulum">
          <line x1={1559} y1={178} x2={1559} y2={226} stroke={t("#c9a26b")} strokeWidth={2} />
          <circle cx={1559} cy={228} r={7} fill={t("#e0b84a")} />
        </g>
      </Prop>
    );
  }
  return (
    <Prop name="street-art-print">
      <Frame x={1450} y={130} w={110} h={80} frame={t("#1f1c1a")} mat={t("#f3efe6")}>
        <circle cx={1485} cy={170} r={22} fill={t("#e0a43a")} />
        <path d="M 1460 200 Q 1500 150 1552 196 Z" fill={t("#2e7d4f")} />
        <path d="M 1500 150 l 40 30 l -20 6 Z" fill={t("#c2463a")} />
      </Frame>
    </Prop>
  );
}

/** The glass: mist, droplets on the inside, drops that run, a heart someone drew, and the sign. */
function Glass({ model }: { model: SceneModel }) {
  const { palette, weather } = model;
  const wet = weather === "rain";
  const misty = palette.fog > 0.15;
  const neon = model.sign.decor.style === "kopi";
  return (
    <Prop name="window-glass">
      <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} fill="url(#cf-fog)" />
      {/* A heart someone drew in the mist with a finger: the glass shows through clearer there. */}
      {misty && (
        <g className="fog-heart" fill="none" stroke={model.palette.street} strokeLinecap="round" opacity={0.55}>
          <path d="M 180 470 c -18 -22 -40 -2 -20 18 l 20 18 l 20 -18 c 20 -20 -2 -40 -20 -18 z" strokeWidth={5} />
          <path d="M 236 488 l 22 -26 m -8 24 l 16 -18" strokeWidth={4} />
        </g>
      )}
      <path d={`M ${WINDOW.x + 40} ${WINDOW.y + WINDOW.h} L ${WINDOW.x + 200} ${WINDOW.y} L ${WINDOW.x + 250} ${WINDOW.y} L ${WINDOW.x + 90} ${WINDOW.y + WINDOW.h} Z`} fill="url(#cf-glass)" opacity={0.35} />
      <path d={`M ${WINDOW.x + 400} ${WINDOW.y + WINDOW.h} L ${WINDOW.x + 520} ${WINDOW.y} L ${WINDOW.x + 540} ${WINDOW.y} L ${WINDOW.x + 420} ${WINDOW.y + WINDOW.h} Z`} fill="url(#cf-glass)" opacity={0.25} />
      {(wet || misty) &&
        Array.from({ length: wet ? 70 : 30 }, (_, i) => {
          const x = WINDOW.x + 8 + rnd(i + 100) * (WINDOW.w - 16);
          const y = WINDOW.y + 10 + Math.pow(rnd(i + 200), 0.7) * (WINDOW.h - 20);
          const r = 1 + rnd(i + 300) * (wet ? 3 : 1.6);
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#eef4f8" opacity={0.28} />
              <circle cx={x - r * 0.3} cy={y - r * 0.35} r={r * 0.35} fill="#ffffff" opacity={0.7} />
            </g>
          );
        })}
      {wet &&
        Array.from({ length: 10 }, (_, i) => {
          const x = WINDOW.x + 30 + rnd(i + 500) * (WINDOW.w - 60);
          const y = WINDOW.y + 20 + rnd(i + 600) * 120;
          return (
            <g key={`s${i}`} className="particle rain-streak" style={{ animationDelay: `${-rnd(i + 700) * 6}s`, animationDuration: `${4 + rnd(i + 800) * 4}s` }}>
              <path d={`M ${x} ${y - 30} q 2 15 0 30`} stroke="#eef4f8" strokeWidth={1.4} opacity={0.35} fill="none" />
              <circle cx={x} cy={y + 2} r={2.6} fill="#eef4f8" opacity={0.6} />
            </g>
          );
        })}
      {neon ? (
        <g>
          <text
            className="glass-sign"
            transform={`translate(${WINDOW.x + WINDOW.w / 2} 170) scale(-1 1)`}
            textAnchor="middle"
            fontFamily={FONT}
            fontSize={38}
            fontStyle="italic"
            fontWeight={600}
            fill="none"
            stroke={model.sign.decor.accent}
            strokeWidth={3}
          >
            {model.sign.name}
          </text>
          <ellipse className="neon" cx={WINDOW.x + WINDOW.w / 2} cy={158} rx={170} ry={40} fill="url(#cf-bokeh-accent)" opacity={model.time === "afternoon" ? 0.25 : 0.6} />
        </g>
      ) : (
        <text
          className="glass-sign"
          transform={`translate(${WINDOW.x + WINDOW.w / 2} 170) scale(-1 1)`}
          textAnchor="middle"
          fontFamily={FONT}
          fontSize={34}
          fontWeight={600}
          letterSpacing={2}
          fill="#e8c26a"
          stroke="#5e3b26"
          strokeWidth={0.8}
          opacity={0.85}
        >
          {model.sign.name}
        </text>
      )}
    </Prop>
  );
}

function WindowFrame({ t }: { t: Tone }) {
  const { x, y, w, h } = WINDOW;
  return (
    <Prop name="window-frame" className="window-frame">
      <rect x={x} y={y} width={w} height={h} fill="none" stroke="url(#cf-trim-v)" strokeWidth={16} />
      <rect x={x + 7} y={y + 7} width={w - 14} height={h - 14} fill="none" stroke="#000000" strokeOpacity={0.25} strokeWidth={2} />
      <rect x={300} y={y} width={12} height={h} fill="url(#cf-trim)" />
      <rect x={540} y={y} width={12} height={h} fill="url(#cf-trim)" />
      <rect x={x} y={250} width={w} height={10} fill="url(#cf-trim-v)" />
      {/* The deep sill, with a shadow under its lip. */}
      <rect x={x - 22} y={y + h - 6} width={w + 44} height={22} rx={3} fill="url(#cf-trim-v)" />
      <rect x={x - 22} y={y + h - 6} width={w + 44} height={4} fill="#ffffff" opacity={0.15} />
      <rect x={x - 18} y={y + h + 16} width={w + 36} height={10} fill="#000000" opacity={0.25} />
      <Prop name="sill-plants">
        <Plant x={112} y={y + h - 22} s={0.95} pot={t("#c9785a")} leaf={t("#5a9a6a")} kind="round" seed={2} />
        <Plant x={160} y={y + h - 20} s={0.8} pot={t("#e6d3a3")} leaf={t("#4f8a5a")} kind="snake" seed={9} />
      </Prop>
      <Prop name="sill-books">
        <rect x={206} y={y + h - 16} width={60} height={9} fill={t("#2f4858")} />
        <rect x={210} y={y + h - 25} width={52} height={9} fill={t("#c2463a")} />
        <rect x={214} y={y + h - 32} width={46} height={7} fill={t("#e6d3a3")} />
        <rect x={236} y={y + h - 50} width={16} height={18} rx={3} fill={t("#f3efe6")} opacity={0.8} />
        <ellipse cx={244} cy={y + h - 53} rx={3} ry={5} fill="#ffcf6a" />
      </Prop>
    </Prop>
  );
}

/** The window, the walls and everything hung on them (M2.5 spec §12, the "window and walls" layer). */
export const Walls = memo(function Walls({ model, brand, cityName, hhmm, paged }: { model: SceneModel; brand: Brand; cityName: string; hhmm: string; paged: boolean }) {
  const t = toner(model);
  return (
    <g className="walls layer-wall" data-layer="walls">
      <WallSurface model={model} t={t} />
      <Glass model={model} />
      <WindowFrame t={t} />
      <g className="interior">
        <Ceiling model={model} t={t} />
        <LeftWall model={model} t={t} />
        <Clocks model={model} t={t} hhmm={hhmm} cityName={cityName} />
        <Poster brand={brand} t={t} />
        <HugOps t={t} />
        <DaysSince days={model.daysSince} paged={paged} t={t} />
        <Prints model={model} t={t} />
        <WifiCorner model={model} t={t} />
        <MenuBoard model={model} t={t} />
        <MenuShelf model={model} t={t} />
        <TallShelves model={model} t={t} />
        <Signature model={model} t={t} />
        <StringLights model={model} />
      </g>
    </g>
  );
});
