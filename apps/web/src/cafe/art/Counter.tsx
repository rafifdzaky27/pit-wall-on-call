import type { SceneModel } from "@pitwall/world";
import { memo } from "react";
import { darken, FONT, lighten, Plant, Prop, Shadow, toner } from "./kit";

/** The radio on the counter (a hotspot). */
export const RADIO = { x: 1300, y: 345, w: 90, h: 55 } as const;
const TOP = 394;

type Tone = ReturnType<typeof toner>;

function CounterBody({ model, t }: { model: SceneModel; t: Tone }) {
  const d = model.sign.decor;
  const front = t(d.style === "kopi" ? "#d8d2c6" : d.style === "laneway" ? lighten(d.trim, 0.25) : d.style === "joglo" ? d.wall[0] : d.wall[1], 1.2);
  return (
    <Prop name="counter">
      <defs>
        <pattern id="cf-counter-tex" width="40" height="40" patternUnits="userSpaceOnUse">
          <rect width="40" height="40" fill={front} />
          {d.style === "laneway" && <path d="M 0 0 V 40 M 13 0 V 40 M 26 0 V 40" stroke={darken(front, 0.35)} strokeWidth={2} />}
          {d.style === "laneway" && <rect x={1} width={3} height={40} fill="#ffffff" opacity={0.08} />}
          {d.style === "kopi" && <path d="M 0 0 H 40 M 0 20 H 40 M 0 0 V 20 M 20 20 V 40" stroke={darken(front, 0.15)} strokeWidth={1.4} />}
          {d.style === "kopi" && <rect x={2} y={2} width={16} height={6} fill="#ffffff" opacity={0.25} />}
          {d.style === "kissaten" && <rect x={4} y={4} width={32} height={32} rx={2} fill="none" stroke={darken(front, 0.4)} strokeWidth={2} />}
          {d.style === "kissaten" && <rect x={5} y={5} width={30} height={2} fill="#ffffff" opacity={0.1} />}
          {d.style === "joglo" && <path d="M 0 20 q 10 -12 20 0 t 20 0 M 0 40 H 40" fill="none" stroke={darken(front, 0.35)} strokeWidth={1.5} />}
        </pattern>
      </defs>
      <rect x={890} y={TOP + 16} width={760} height={620 - TOP - 16} fill="url(#cf-counter-tex)" />
      <rect x={890} y={TOP + 16} width={760} height={620 - TOP - 16} fill="url(#cf-counter)" />
      {/* A brass foot rail and the shadow along the floor. */}
      <rect x={890} y={580} width={760} height={5} rx={2} fill={t("#c9a24a")} />
      <rect x={890} y={580} width={760} height={1.5} fill="#ffffff" opacity={0.4} />
      <rect x={890} y={612} width={760} height={12} fill="#000000" opacity={0.25} />
      {/* The top slab. */}
      <rect x={882} y={TOP} width={770} height={18} rx={3} fill="url(#cf-wood)" />
      <rect x={882} y={TOP} width={770} height={3} rx={1.5} fill="#ffffff" opacity={0.2} />
      <rect x={882} y={TOP + 18} width={770} height={6} fill="#000000" opacity={0.3} />
      {d.style === "joglo" && (
        <g>
          <rect x={960} y={TOP + 18} width={90} height={60} fill={t(d.accent)} />
          <rect x={960} y={TOP + 18} width={90} height={60} fill="url(#cf-batik)" />
          <path d={`M 960 ${TOP + 78} l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8 l 6 -8 l 6 8`} fill={t(d.accent)} />
        </g>
      )}
    </Prop>
  );
}

function Barista({ model, t }: { model: SceneModel; t: Tone }) {
  const d = model.sign.decor;
  const skin = t(model.palette.skin[1]!);
  const cx = 1264;
  return (
    <Prop name="barista" className="barista">
      <path d={`M ${cx - 32} ${TOP + 4} Q ${cx - 34} 314 ${cx - 16} 306 L ${cx + 16} 306 Q ${cx + 34} 314 ${cx + 32} ${TOP + 4} Z`} fill={t(d.style === "kissaten" ? "#f3efe6" : "#2a2d33")} />
      {d.style === "kissaten" && <path d={`M ${cx - 20} 308 L ${cx - 10} ${TOP} L ${cx + 10} ${TOP} L ${cx + 20} 308 Z`} fill={t("#2a1a10")} />}
      <path d={`M ${cx - 18} 322 L ${cx + 18} 322 L ${cx + 22} ${TOP + 4} L ${cx - 22} ${TOP + 4} Z`} fill={t(d.style === "kissaten" ? "#2a1a10" : d.accent)} />
      <path d={`M ${cx - 16} 322 L ${cx - 24} 306 M ${cx + 16} 322 L ${cx + 24} 306`} stroke={t(d.style === "kissaten" ? "#2a1a10" : d.accent)} strokeWidth={3} />
      <rect x={cx - 7} y={288} width={14} height={18} fill={darken(skin, 0.12)} />
      {d.style === "kissaten" && <path d={`M ${cx - 7} 308 l 7 4 l 7 -4 l 0 8 l -7 -4 l -7 4 Z`} fill={t("#9e2b31")} />}
      <g className="patron-head" style={{ animationDelay: "3.1s" }}>
        <circle cx={cx} cy={272} r={19} fill={skin} />
        <path d={`M ${cx + 6} 256 Q ${cx + 20} 262 ${cx + 18} 280 Q ${cx + 12} 290 ${cx + 4} 290 Q ${cx + 14} 276 ${cx + 6} 256 Z`} fill={darken(skin, 0.12)} opacity={0.6} />
        <circle cx={cx - 7} cy={272} r={1.8} fill="#1f1a17" />
        <circle cx={cx + 7} cy={272} r={1.8} fill="#1f1a17" />
        <path d={`M ${cx - 5} 281 q 5 4 10 0`} fill="none" stroke="#1f1a17" strokeWidth={1.4} strokeLinecap="round" />
        {d.style === "joglo" ? (
          <g>
            <path d={`M ${cx - 20} 268 Q ${cx - 20} 248 ${cx} 248 Q ${cx + 20} 248 ${cx + 20} 268 Z`} fill={t(d.accent)} />
            <path d={`M ${cx - 20} 268 Q ${cx - 20} 248 ${cx} 248 Q ${cx + 20} 248 ${cx + 20} 268 Z`} fill="url(#cf-batik)" />
            <circle cx={cx + 20} cy={262} r={6} fill={t(d.accent)} />
          </g>
        ) : d.style === "laneway" ? (
          <path d={`M ${cx - 20} 268 Q ${cx - 22} 244 ${cx} 244 Q ${cx + 22} 244 ${cx + 20} 268 Z`} fill={t("#c9785a")} />
        ) : d.style === "kopi" ? (
          <g>
            <path d={`M ${cx - 20} 266 Q ${cx - 18} 246 ${cx} 246 Q ${cx + 20} 246 ${cx + 20} 266 Z`} fill={t("#1f1c1a")} />
            <path d={`M ${cx - 20} 266 L ${cx - 34} 266 Q ${cx - 28} 260 ${cx - 18} 260 Z`} fill={t("#1f1c1a")} />
          </g>
        ) : (
          <path d={`M ${cx - 20} 270 Q ${cx - 20} 250 ${cx} 250 Q ${cx + 20} 250 ${cx + 20} 270 Q ${cx + 14} 258 ${cx} 258 Q ${cx - 14} 258 ${cx - 20} 270 Z`} fill={t("#8a8a8a")} />
        )}
      </g>
      <g className="barista-arm">
        <path d={`M ${cx - 26} 318 Q ${cx - 44} 350 ${cx - 36} 372`} fill="none" stroke={t(d.style === "kissaten" ? "#f3efe6" : "#2a2d33")} strokeWidth={11} strokeLinecap="round" />
        <circle cx={cx - 36} cy={374} r={6} fill={skin} />
        <path d={`M ${cx - 46} 362 L ${cx - 30} 362 L ${cx - 31} 384 L ${cx - 45} 384 Z`} fill="url(#cf-chrome)" />
      </g>
    </Prop>
  );
}

function PastryCase({ model, t }: { model: SceneModel; t: Tone }) {
  const style = model.sign.decor.style;
  const treat = (x: number, y: number, i: number) => {
    if (style === "kissaten")
      return (
        <g key={`${x}${y}`}>
          <path d={`M ${x - 8} ${y} L ${x - 6} ${y - 11} L ${x + 6} ${y - 11} L ${x + 8} ${y} Z`} fill={t("#f2c46a")} />
          <path d={`M ${x - 6} ${y - 11} L ${x + 6} ${y - 11} L ${x + 5} ${y - 8} L ${x - 5} ${y - 8} Z`} fill={t("#6b3a1a")} />
          {i % 2 === 0 && <circle cx={x} cy={y - 14} r={2.4} fill="#c2463a" />}
        </g>
      );
    if (style === "joglo")
      return i % 2 ? (
        <g key={`${x}${y}`}>
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={x - 6 + k * 6} cy={y - 4} r={3.6} fill={t("#5aa05a")} />
          ))}
        </g>
      ) : (
        <ellipse key={`${x}${y}`} cx={x} cy={y - 4} rx={9} ry={4.5} fill={t("#e8c890")} />
      );
    if (style === "kopi")
      return (
        <g key={`${x}${y}`}>
          <rect x={x - 10} y={y - 9} width={20} height={9} rx={2} fill={t(i % 2 ? "#e8b870" : "#6aa04a")} />
          <rect x={x - 10} y={y - 5} width={20} height={2} fill={t(i % 2 ? "#6b3a1a" : "#f3efe6")} />
        </g>
      );
    return (
      <path key={`${x}${y}`} d={`M ${x - 11} ${y} Q ${x - 9} ${y - 12} ${x} ${y - 10} Q ${x + 9} ${y - 12} ${x + 11} ${y} Q ${x} ${y + 2} ${x - 11} ${y} Z`} fill={t(i % 2 ? "#d89a4a" : "#b8743a")} />
    );
  };
  return (
    <Prop name="pastry-case">
      <Shadow cx={960} cy={TOP + 2} rx={60} ry={5} />
      <rect x={904} y={322} width={112} height={72} rx={4} fill={t("#dfe7ef")} opacity={0.18} />
      <rect x={904} y={322} width={112} height={72} rx={4} fill="none" stroke={t("#c9ced4")} strokeWidth={2} />
      <rect x={904} y={358} width={112} height={3} fill={t("#c9ced4")} />
      {[924, 948, 972, 996].map((x, i) => treat(x, 356, i))}
      {[928, 956, 986].map((x, i) => treat(x, 390, i + 1))}
      <path d="M 910 326 L 930 326 L 914 388 L 908 388 Z" fill="#ffffff" opacity={0.25} />
      <rect x={900} y={318} width={120} height={6} rx={3} fill={t(model.sign.decor.trim)} />
    </Prop>
  );
}

function TipJar({ model, t }: { model: SceneModel; t: Tone }) {
  const tip = model.sign.decor.tip;
  return (
    <Prop name="tip-jar">
      <Shadow cx={1032} cy={TOP + 1} rx={16} ry={3} />
      <rect x={1020} y={354} width={26} height={40} rx={5} fill={t("#e8f0f4")} opacity={0.35} />
      <rect x={1022} y={378} width={22} height={14} rx={3} fill={t("#c9a24a")} opacity={0.9} />
      <rect x={1026} y={372} width={12} height={8} fill={t("#6aa87a")} transform="rotate(-12 1032 376)" />
      <rect x={1023} y={358} width={3} height={32} rx={1.5} fill="#ffffff" opacity={0.5} />
      <rect x={1018} y={350} width={30} height={5} rx={2} fill={t("#9aa0a6")} />
      <rect x={1018} y={362} width={30} height={10} rx={1} fill={t("#f3efe6")} />
      <text x={1033} y={369.5} textAnchor="middle" fontFamily={FONT} fontSize={tip.length > 5 ? 3.6 : 6} fontWeight={700} fill="#1f1a17">
        {tip}
      </text>
    </Prop>
  );
}

function Espresso({ model, t }: { model: SceneModel; t: Tone }) {
  const x = 1052;
  const y = 296;
  const w = 144;
  if (model.sign.decor.style === "kissaten") {
    // A siphon bar: glass globes over little burners.
    return (
      <Prop name="siphon-bar" className="espresso">
        <Shadow cx={x + w / 2} cy={TOP + 2} rx={80} ry={6} />
        <rect x={x} y={TOP - 14} width={w} height={14} rx={3} fill={t("#2a1a10")} />
        {[0, 1, 2].map((i) => {
          const cx = x + 26 + i * 46;
          return (
            <g key={i}>
              <rect x={cx - 2} y={y + 4} width={4} height={TOP - 14 - y - 4} fill={t("#8a8f96")} />
              <path d={`M ${cx - 12} ${y + 20} Q ${cx - 14} ${y + 4} ${cx} ${y + 2} Q ${cx + 14} ${y + 4} ${cx + 12} ${y + 20} L ${cx + 3} ${y + 40} L ${cx - 3} ${y + 40} Z`} fill={t("#dfe7ef")} opacity={0.45} />
              <circle cx={cx} cy={y + 60} r={16} fill={t("#dfe7ef")} opacity={0.35} />
              <path d={`M ${cx - 15} ${y + 64} Q ${cx} ${y + 80} ${cx + 15} ${y + 64} Z`} fill={t("#4a2a14")} opacity={0.9} />
              <circle cx={cx - 6} cy={y + 54} r={4} fill="#ffffff" opacity={0.45} />
              <rect x={cx - 8} y={TOP - 22} width={16} height={8} rx={2} fill={t("#5a5f66")} />
              <ellipse className="flame" cx={cx} cy={TOP - 26} rx={4} ry={6} fill="#ffb45e" opacity={0.9} />
              <path className="particle steam espresso-steam" d={`M ${cx} ${y - 2} q -6 -10 0 -20 q 6 -10 0 -20`} fill="none" stroke="#ffffff" strokeWidth={3} strokeLinecap="round" opacity={0.3} style={{ animationDelay: `${i * 0.9}s` }} />
            </g>
          );
        })}
      </Prop>
    );
  }
  return (
    <Prop name="espresso-machine" className="espresso">
      <Shadow cx={x + w / 2} cy={TOP + 2} rx={84} ry={6} />
      <rect x={x} y={y} width={w} height={TOP - y} rx={10} fill="url(#cf-chrome)" />
      <rect x={x} y={y} width={w} height={14} rx={7} fill={t(model.sign.decor.style === "laneway" ? "#2e7d4f" : model.sign.decor.style === "kopi" ? "#1f1c1a" : "#8a3a24")} />
      <rect x={x + 8} y={y + 20} width={w - 16} height={30} rx={6} fill={t("#5a5f66")} opacity={0.5} />
      {[x + 34, x + w - 34].map((px) => (
        <g key={px}>
          <circle cx={px} cy={y + 35} r={9} fill={t("#f6f1e6")} />
          <circle cx={px} cy={y + 35} r={9} fill="none" stroke={t("#3d4146")} strokeWidth={2} />
          <line x1={px} y1={y + 35} x2={px + 5} y2={y + 30} stroke="#c2463a" strokeWidth={1.4} />
          <rect x={px - 16} y={y + 56} width={32} height={10} rx={3} fill={t("#3d4146")} />
          <rect x={px - 4} y={y + 66} width={8} height={8} fill={t("#3d4146")} />
          <path d={`M ${px + 12} ${y + 60} L ${px + 36} ${y + 64}`} stroke={t("#1f1c1a")} strokeWidth={5} strokeLinecap="round" />
          <path d={`M ${px - 9} ${y + 78} L ${px + 9} ${y + 78} L ${px + 8} ${y + 94} L ${px - 8} ${y + 94} Z`} fill={t("#f3efe8")} />
        </g>
      ))}
      <path d={`M ${x + w - 8} ${y + 50} q 12 10 6 40`} fill="none" stroke="url(#cf-chrome)" strokeWidth={4} />
      {/* Cups warming on top. */}
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M ${x + 14 + i * 24} ${y} L ${x + 30 + i * 24} ${y} L ${x + 28 + i * 24} ${y - 14} L ${x + 16 + i * 24} ${y - 14} Z`} fill={t(i % 2 ? "#f3efe8" : "#e8ddd0")} />
      ))}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          className="particle steam espresso-steam"
          d={`M ${x + 30 + i * 40} ${y - 18} q -8 -14 0 -28 q 8 -14 0 -28`}
          fill="none"
          stroke="#ffffff"
          strokeWidth={4}
          strokeLinecap="round"
          opacity={0.35}
          style={{ animationDelay: `${i * 0.9}s` }}
        />
      ))}
    </Prop>
  );
}

function Grinder({ t }: { t: Tone }) {
  return (
    <Prop name="grinder">
      <Shadow cx={1216} cy={TOP + 1} rx={20} ry={4} />
      <path d="M 1200 310 L 1232 310 L 1224 340 L 1208 340 Z" fill={t("#dfe7ef")} opacity={0.5} />
      <path d="M 1203 320 L 1229 320 L 1224 338 L 1208 338 Z" fill={t("#4a2a14")} />
      <rect x={1204} y={338} width={24} height={40} rx={4} fill={t("#2a2d33")} />
      <rect x={1206} y={340} width={4} height={36} fill="#ffffff" opacity={0.15} />
      <rect x={1200} y={378} width={32} height={16} rx={3} fill={t("#3d4146")} />
    </Prop>
  );
}

function Radio({ on, t }: { on: boolean; t: Tone }) {
  const { x, y, w, h } = RADIO;
  return (
    <Prop name="radio" className={`radio${on ? " playing" : ""}`}>
      <Shadow cx={x + w / 2} cy={y + h} rx={50} ry={5} />
      <rect x={x} y={y} width={w} height={h} rx={10} fill={t("#b0703f")} />
      <rect x={x} y={y} width={w} height={h / 2} rx={10} fill="#ffffff" opacity={0.12} />
      <g className="radio-grille">
        <rect x={x + 8} y={y + 10} width={40} height={36} rx={5} fill={t("#5a3a22")} />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1={x + 12} y1={y + 17 + i * 8} x2={x + 44} y2={y + 17 + i * 8} stroke={t("#8a5a3b")} strokeWidth={2} />
        ))}
      </g>
      <rect x={x + 54} y={y + 8} width={30} height={10} rx={2} fill={t("#f3e7cf")} />
      <line x1={x + 62} y1={y + 9} x2={x + 62} y2={y + 17} stroke="#c2463a" strokeWidth={1.4} />
      <circle cx={x + 68} cy={y + 30} r={8} fill={t("#e6d3a3")} />
      <line x1={x + 68} y1={y + 30} x2={x + 73} y2={y + 25} stroke={t("#5a3a22")} strokeWidth={2} />
      <circle className={`radio-led${on ? " on" : ""}`} cx={x + 68} cy={y + 46} r={3} fill={on ? "#6bdc7b" : "#4a3a2a"} />
      {on && <circle cx={x + 68} cy={y + 46} r={10} fill="url(#cf-bokeh-glow)" opacity={0.6} />}
      <line x1={x + w - 12} y1={y} x2={x + w + 10} y2={y - 40} stroke={t("#555555")} strokeWidth={2} />
    </Prop>
  );
}

/** The far end of the counter, seen on wide screens: cups, jugs, the till, flowers, and the city's own brew. */
function CounterEnd({ model, t }: { model: SceneModel; t: Tone }) {
  const style = model.sign.decor.style;
  return (
    <>
      <Prop name="cup-stack">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M 1402 ${TOP - i * 9} L 1424 ${TOP - i * 9} L 1426 ${TOP - 9 - i * 9} L 1400 ${TOP - 9 - i * 9} Z`} fill={t(i % 2 ? "#f3efe8" : "#e3dbcf")} />
        ))}
        {[0, 1, 2, 3].map((i) => (
          <path key={`k${i}`} d={`M 1430 ${TOP - i * 7} L 1446 ${TOP - i * 7} L 1447 ${TOP - 7 - i * 7} L 1429 ${TOP - 7 - i * 7} Z`} fill={t(model.sign.decor.accent)} opacity={0.9} />
        ))}
      </Prop>
      {(style === "laneway" || style === "kopi") && (
        <Prop name="milk-jugs">
          <path d="M 1456 394 L 1476 394 L 1474 368 L 1482 362 L 1458 362 Z" fill="url(#cf-chrome)" />
          <path d="M 1484 394 L 1500 394 L 1499 374 L 1505 370 L 1485 370 Z" fill="url(#cf-chrome)" />
        </Prop>
      )}
      <Prop name="till">
        <rect x={1512} y={352} width={50} height={34} rx={3} fill={t("#1f1c1a")} transform="rotate(-8 1537 369)" />
        <rect x={1516} y={356} width={42} height={26} rx={2} fill={t("#8fd0e8")} opacity={0.8} transform="rotate(-8 1537 369)" />
        <rect x={1532} y={380} width={10} height={14} fill={t("#3d4146")} />
      </Prop>
      <Prop name="flower-vase">
        <rect x={1576} y={362} width={16} height={32} rx={6} fill={t("#8fb8c8")} opacity={0.8} />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <line x1={1584} y1={362} x2={1576 + i * 8} y2={330 + i * 4} stroke={t("#4f8a5a")} strokeWidth={1.6} />
            <circle cx={1576 + i * 8} cy={328 + i * 4} r={6} fill={t(["#e86a7a", "#f3c94a", "#ffffff"][i]!)} />
          </g>
        ))}
      </Prop>
      {style === "joglo" && (
        <Prop name="kopi-joss-brazier">
          <path d="M 1458 394 L 1498 394 L 1504 374 L 1452 374 Z" fill={t("#6a4a3a")} />
          <ellipse cx={1478} cy={374} rx={26} ry={5} fill="#ff7a3a" opacity={0.8} />
          <path d="M 1466 372 L 1490 372 L 1488 352 L 1468 352 Z" fill={t("#3d4146")} />
          <path d="M 1490 360 q 10 -2 12 -10" fill="none" stroke={t("#3d4146")} strokeWidth={3} />
        </Prop>
      )}
      {style === "kissaten" && (
        <Prop name="drip-kettle">
          <path d="M 1466 394 L 1496 394 L 1492 366 L 1470 366 Z" fill={t("#c9784a")} />
          <path d="M 1470 372 Q 1450 370 1446 350" fill="none" stroke={t("#c9784a")} strokeWidth={3} />
        </Prop>
      )}
      <Prop name="counter-plant">
        <Plant x={898} y={TOP - 14} s={0.7} pot={t("#e6d3a3")} leaf={t("#4f8a5a")} kind="snake" seed={31} />
      </Prop>
    </>
  );
}

/** The counter, the barista and the machines (M2.5 spec §12, the counter layer). */
export const Counter = memo(function Counter({ model, radioOn }: { model: SceneModel; radioOn: boolean }) {
  const t = toner(model);
  return (
    <g className="counter layer-wall" data-layer="counter">
      <Barista model={model} t={t} />
      <CounterBody model={model} t={t} />
      <PastryCase model={model} t={t} />
      <TipJar model={model} t={t} />
      <Espresso model={model} t={t} />
      <Grinder t={t} />
      <Radio on={radioOn} t={t} />
      <CounterEnd model={model} t={t} />
    </g>
  );
});
