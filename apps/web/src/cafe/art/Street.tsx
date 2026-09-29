import type { SceneModel } from "@pitwall/world";
import { memo, type ReactNode } from "react";
import { darken, FONT, lighten, Prop, rectsPath, rnd } from "./kit";

/** The window opening in scene units; everything in this file is clipped to it. */
export const WINDOW = { x: 80, y: 90, w: 680, h: 430 } as const;
const BASELINE = 430;
const KERB = 492;
const RAIN_DROPS = 90;

type Bokeh = "warm" | "glow" | "accent" | "red" | "cyan" | "white";

function Sky({ model }: { model: SceneModel }) {
  const { time, weather } = model;
  const cloudy = weather !== "clear";
  return (
    <Prop name="sky">
      <rect x={WINDOW.x - 30} y={WINDOW.y - 30} width={WINDOW.w + 60} height={WINDOW.h + 60} fill="url(#cf-sky)" />
      {time === "night" &&
        Array.from({ length: 26 }, (_, i) => <circle key={i} cx={70 + rnd(i) * 700} cy={100 + rnd(i + 50) * 160} r={0.6 + rnd(i + 9) * 1.1} fill="#fff6e0" opacity={0.4 + rnd(i + 3) * 0.5} />)}
      {time === "night" && !cloudy && (
        <g>
          <circle cx={680} cy={140} r={40} fill="url(#cf-bokeh-white)" opacity={0.5} />
          <circle cx={680} cy={140} r={15} fill="#f6f1de" />
          <circle cx={686} cy={136} r={13} fill="#dcd6c2" opacity={0.25} />
        </g>
      )}
      {time === "dusk" && <circle cx={220} cy={300} r={120} fill="url(#cf-bokeh-warm)" opacity={0.8} />}
      {(time === "morning" || time === "afternoon") && <circle cx={time === "morning" ? 170 : 640} cy={150} r={110} fill="url(#cf-bokeh-white)" opacity={cloudy ? 0.3 : 0.7} />}
      {Array.from({ length: cloudy ? 7 : 3 }, (_, i) => (
        <g key={i} opacity={cloudy ? 0.55 : 0.4}>
          <ellipse cx={90 + i * 110 + rnd(i) * 40} cy={120 + rnd(i + 4) * 60} rx={70 + rnd(i + 2) * 40} ry={16 + rnd(i + 6) * 8} fill={weather === "rain" ? "#8a929c" : "#ffffff"} opacity={0.6} />
          <ellipse cx={110 + i * 110 + rnd(i) * 40} cy={110 + rnd(i + 4) * 60} rx={40} ry={14} fill={weather === "rain" ? "#9aa2ac" : "#ffffff"} opacity={0.5} />
        </g>
      ))}
    </Prop>
  );
}

/** Yogyakarta's volcano on the horizon, or a hazy far range everywhere else. */
function Horizon({ model }: { model: SceneModel }) {
  if (model.sign.decor.style !== "joglo") return null;
  return (
    <Prop name="merapi">
      <path d="M 200 430 L 400 205 Q 420 188 440 205 L 690 430 Z" fill={lighten(model.palette.buildings, 0.35)} opacity={0.6} />
      <path d="M 400 205 Q 420 188 440 205 L 455 222 Q 430 214 420 226 Q 408 214 388 219 Z" fill="#ffffff" opacity={0.35} />
      <path d="M 420 190 q -10 -18 6 -30 q 16 -12 4 -30" fill="none" stroke="#ffffff" strokeWidth={8} strokeLinecap="round" opacity={0.25} />
    </Prop>
  );
}

const isLit = (model: SceneModel) => model.time === "dusk" || model.time === "night";

/** The towers behind; after dark only their windows are drawn again, over the street's shade. */
function Skyline({ model, glow = false }: { model: SceneModel; glow?: boolean }) {
  const lit = isLit(model);
  if (glow && !lit) return null;
  const shops = shopsFor(model);
  const roof = model.sign.decor.style === "joglo" ? 36 : 0;
  // Only the windows that show above the shops across the road.
  const hidden = (cx: number, cy: number) => shops.some((s) => cx + 6 > s.x - roof && cx < s.x + s.w + roof && cy + 9 > s.top - roof);
  // A fixed pattern of lit windows, so the same city looks the same every night; a few of them flicker.
  const steady: [number, number, number, number][] = [];
  const flicker: [number, number][] = [];
  model.sign.skyline.forEach(([x, w, h], i) => {
    const cols = Math.floor((w - 12) / 18);
    for (let j = 0; j < Math.floor((h - 20) / 22) * cols; j++) {
      const cx = x + 8 + (j % cols) * 18;
      const cy = BASELINE - h + 12 + Math.floor(j / cols) * 22;
      if (hidden(cx, cy)) continue;
      if (!lit) {
        if ((j + i) % 3 === 0) steady.push([cx, cy, 6, 9]);
      } else if ((j * 7 + i * 3) % 5 < 2) {
        if ((j + i) % 6 === 0) flicker.push([cx, cy]);
        else steady.push([cx, cy, 6, 9]);
      }
    }
  });
  const windows = (
    <g>
      <path d={rectsPath(steady)} fill={lit ? "#ffd98a" : "#ffffff"} opacity={lit ? 1 : 0.25} />
      {flicker.map(([cx, cy], k) => (
        <rect key={k} className="lit-window" x={cx} y={cy} width={6} height={9} fill="#ffd98a" style={{ animationDelay: `${(k % 7) * 1.1}s` }} />
      ))}
    </g>
  );
  if (glow) return <g className="skyline-lights">{windows}</g>;
  return (
    <Prop name="skyline">
      {model.sign.skyline.map(([x, w, h], i) => (
        <g key={i}>
          <rect x={x} y={BASELINE - h} width={w} height={h} fill={lighten(model.palette.buildings, 0.12 + (i % 3) * 0.06)} opacity={0.85} />
          <rect x={x} y={BASELINE - h} width={w * 0.3} height={h} fill="#000000" opacity={0.12} />
          <rect x={x - 2} y={BASELINE - h - 4} width={w + 4} height={5} fill={darken(model.palette.buildings, 0.1)} />
          {i % 2 === 0 && <rect x={x + w * 0.6} y={BASELINE - h - 16} width={3} height={12} fill={darken(model.palette.buildings, 0.2)} />}
        </g>
      ))}
      {!lit && windows}
      <rect x={WINDOW.x - 30} y={BASELINE - 160} width={WINDOW.w + 60} height={160} fill="url(#cf-haze)" />
    </Prop>
  );
}

interface Shop {
  x: number;
  w: number;
  top: number;
  wall: string;
  sign: string;
  signBg: string;
  signInk: string;
  bokeh: Bokeh;
}

function shopsFor(model: SceneModel): Shop[] {
  const d = model.sign.decor;
  return {
    laneway: [
      { x: 40, w: 250, top: 196, wall: "#7a3b2a", sign: d.shops[0], signBg: "#b3262e", signInk: "#ffe7b0", bokeh: "red" as Bokeh },
      { x: 290, w: 240, top: 226, wall: "#3f4a52", sign: d.shops[1], signBg: "#1f1c1a", signInk: "#f3e7cf", bokeh: "warm" as Bokeh },
      { x: 530, w: 270, top: 206, wall: "#8a6b4a", sign: d.shops[2], signBg: "#2e7d4f", signInk: "#f6f1e6", bokeh: "glow" as Bokeh },
    ],
    kissaten: [
      { x: 40, w: 230, top: 216, wall: "#5a5550", sign: d.shops[0], signBg: "#b3262e", signInk: "#fff4dc", bokeh: "red" as Bokeh },
      { x: 270, w: 250, top: 196, wall: "#6e6a60", sign: d.shops[1], signBg: "#2f6fb0", signInk: "#ffffff", bokeh: "cyan" as Bokeh },
      { x: 520, w: 280, top: 226, wall: "#4a3f3a", sign: d.shops[2], signBg: "#e0a43a", signInk: "#2a1a10", bokeh: "warm" as Bokeh },
    ],
    kopi: [
      { x: 40, w: 250, top: 206, wall: "#c9b48a", sign: d.shops[0], signBg: "#2f7d4f", signInk: "#fff4a8", bokeh: "glow" as Bokeh },
      { x: 290, w: 220, top: 226, wall: "#d8d0c0", sign: d.shops[1], signBg: "#1f8a5a", signInk: "#ffffff", bokeh: "cyan" as Bokeh },
      { x: 510, w: 290, top: 196, wall: "#b88a6a", sign: d.shops[2], signBg: "#d8322a", signInk: "#ffe24a", bokeh: "red" as Bokeh },
    ],
    joglo: [
      { x: 40, w: 250, top: 262, wall: "#e8dcc0", sign: d.shops[0], signBg: "#7a4a1f", signInk: "#fff4dc", bokeh: "warm" as Bokeh },
      { x: 290, w: 230, top: 272, wall: "#d8c8a4", sign: d.shops[1], signBg: "#2f3f6e", signInk: "#ffe7b0", bokeh: "glow" as Bokeh },
      { x: 520, w: 280, top: 256, wall: "#e2d4b4", sign: d.shops[2], signBg: "#8a2a1f", signInk: "#fff4dc", bokeh: "warm" as Bokeh },
    ],
  }[d.style];
}

/** A shop's sign board and its window: what still shines once the street has gone dark. */
function ShopLights({ s, i, lit, style }: { s: Shop; i: number; lit: boolean; style: SceneModel["sign"]["decor"]["style"] }) {
  return (
    <g>
      <rect x={s.x + 16} y={BASELINE - 96} width={s.w - 32} height={28} rx={3} fill={s.signBg} />
      <rect x={s.x + 16} y={BASELINE - 96} width={s.w - 32} height={6} rx={3} fill="#ffffff" opacity={0.15} />
      <text x={s.x + s.w / 2} y={BASELINE - 76} textAnchor="middle" fontFamily={FONT} fontSize={s.sign.length > 11 ? 13 : 16} fontWeight={700} letterSpacing={1} fill={s.signInk}>
        {s.sign}
      </text>
      <rect x={s.x + 14} y={BASELINE - 42} width={s.w - 60} height={42} fill={lit ? "#ffcf8a" : "#9fb4c0"} opacity={lit ? 0.85 : 0.6} />
      {[0, 1, 2, 3].map((k) => (
        <rect key={k} x={s.x + 24 + k * 22} y={BASELINE - 26} width={12} height={16} rx={2} fill={["#c2463a", "#3b7d4f", "#e0a43a", "#3b6ea5"][(k + i) % 4]} opacity={0.8} />
      ))}
      {style === "kissaten" && (
        <g>
          <rect x={s.x + 4} y={s.top + 14} width={16} height={100} rx={2} fill={s.signBg} />
          {s.sign.split("").map((ch, k) => (
            <text key={k} x={s.x + 12} y={s.top + 32 + k * 18} textAnchor="middle" fontFamily={FONT} fontSize={13} fontWeight={700} fill={s.signInk}>
              {ch}
            </text>
          ))}
          <ellipse cx={s.x + s.w - 60} cy={BASELINE - 60} rx={9} ry={13} fill="#d8322a" />
        </g>
      )}
      {lit &&
        [0, 1, 2].map((k) =>
          (i + k) % 2 === 0 ? <rect key={`w${k}`} x={s.x + 22 + k * ((s.w - 60) / 2)} y={s.top + 18} width={30} height={38} fill="#ffd98a" opacity={0.85} /> : null,
        )}
    </g>
  );
}

/** After dark, the signs and lit windows drawn again over the street's shade, with their bokeh. */
function StreetGlow({ model }: { model: SceneModel }) {
  const lit = isLit(model);
  const shops = shopsFor(model);
  return (
    <>
      {lit && shops.map((s, i) => <ShopLights key={i} s={s} i={i} lit style={model.sign.decor.style} />)}
      <Bokehs
        spots={shops.flatMap((s, i) => [
          { x: s.x + s.w / 2 - 40, y: BASELINE - 82, r: 20 + (i % 2) * 6, c: s.bokeh },
          { x: s.x + s.w / 2 + 50, y: BASELINE - 78, r: 14, c: s.bokeh },
          { x: s.x + 60, y: BASELINE - 20, r: 16, c: "warm" as Bokeh },
        ])}
        lit={lit}
      />
    </>
  );
}

/** The facades across the road, each with a sign in the city's language. */
function Shopfronts({ model }: { model: SceneModel }) {
  const d = model.sign.decor;
  const lit = isLit(model);
  const shops = shopsFor(model);
  return (
    <>
      {shops.map((s, i) => (
        <Prop key={i} name={`shopfront-${i + 1}`}>
          <rect x={s.x} y={s.top} width={s.w} height={BASELINE - s.top} fill={s.wall} />
          <rect x={s.x} y={s.top} width={s.w} height={BASELINE - s.top} fill="url(#cf-wall-light)" opacity={0.8} />
          <rect x={s.x + s.w - 14} y={s.top} width={14} height={BASELINE - s.top} fill="#000000" opacity={0.15} />
          {d.style === "joglo" && <path d={`M ${s.x - 14} ${s.top + 4} L ${s.x + 30} ${s.top - 34} L ${s.x + s.w - 30} ${s.top - 34} L ${s.x + s.w + 14} ${s.top + 4} Z`} fill="#9a4a2a" />}
          {d.style === "joglo" && <path d={`M ${s.x - 14} ${s.top + 4} L ${s.x + s.w + 14} ${s.top + 4}`} stroke="#6a3018" strokeWidth={4} />}
          {/* Upper floor windows. */}
          {[0, 1, 2].map((k) => {
            const wx = s.x + 22 + k * ((s.w - 60) / 2);
            const on = lit && (i + k) % 2 === 0;
            return (
              <g key={k}>
                <rect x={wx} y={s.top + 18} width={30} height={38} fill={on ? "#ffd98a" : darken(s.wall, 0.45)} opacity={on ? 0.9 : 1} />
                <rect x={wx} y={s.top + 18} width={30} height={38} fill="none" stroke={darken(s.wall, 0.3)} strokeWidth={3} />
                {d.style === "kopi" && k === 1 && <rect x={wx - 2} y={s.top + 60} width={34} height={16} rx={2} fill="#dfe3e6" />}
                {d.style === "laneway" && <rect x={wx - 4} y={s.top + 56} width={38} height={5} fill={darken(s.wall, 0.35)} />}
              </g>
            );
          })}
          {/* Awning, the sign board, the shop window and the door. */}
          <path d={`M ${s.x + 10} ${BASELINE - 66} L ${s.x + s.w - 10} ${BASELINE - 66} L ${s.x + s.w} ${BASELINE - 44} L ${s.x} ${BASELINE - 44} Z`} fill={darken(s.signBg, 0.1)} />
          <path d={`M ${s.x + 10} ${BASELINE - 66} L ${s.x + s.w - 10} ${BASELINE - 66} L ${s.x + s.w} ${BASELINE - 44} L ${s.x} ${BASELINE - 44} Z`} fill="url(#cf-stripes)" opacity={0.35} />
          <ShopLights s={s} i={i} lit={lit} style={d.style} />
          <rect x={s.x + 20} y={BASELINE - 30} width={s.w - 72} height={3} fill={darken(s.wall, 0.4)} opacity={0.6} />
          <rect x={s.x + s.w - 42} y={BASELINE - 46} width={26} height={46} fill={darken(s.wall, 0.5)} />
          {d.style === "kissaten" &&
            [0, 1, 2].map((k) => <rect key={k} x={s.x + s.w - 42 + k * 9} y={BASELINE - 46} width={8} height={24} fill={i === 0 ? "#2a3f6e" : "#e8e0cc"} />)}
        </Prop>
      ))}
    </>
  );
}

/** Out-of-focus lights: soft discs from the signs and lamps outside (M2.5 spec §12). */
function Bokehs({ spots, lit }: { spots: { x: number; y: number; r: number; c: Bokeh }[]; lit: boolean }) {
  return (
    <Prop name="bokeh">
      {spots.map((b, i) => (
        <circle
          key={i}
          className={i % 3 === 0 ? "particle bokeh" : undefined}
          cx={b.x}
          cy={b.y}
          r={b.r}
          fill={`url(#cf-bokeh-${b.c})`}
          opacity={lit ? 0.85 : 0.35}
          style={i % 3 === 0 ? { animationDelay: `${-i * 1.3}s` } : undefined}
        />
      ))}
    </Prop>
  );
}

function Road({ model }: { model: SceneModel }) {
  const d = model.sign.decor;
  const wet = model.weather === "rain";
  const dark = model.time === "dusk" || model.time === "night";
  return (
    <Prop name="road">
      <rect x={WINDOW.x - 30} y={BASELINE} width={WINDOW.w + 60} height={KERB - BASELINE} fill="url(#cf-street)" />
      {d.style === "laneway" ? (
        <g>
          <path d={`M ${WINDOW.x - 30} 458 H ${WINDOW.x + WINDOW.w + 30} M ${WINDOW.x - 30} 470 H ${WINDOW.x + WINDOW.w + 30}`} stroke="#9aa0a6" strokeWidth={2} opacity={0.6} />
          <path d={`M ${WINDOW.x - 30} 476 H ${WINDOW.x + WINDOW.w + 30} M ${WINDOW.x - 30} 486 H ${WINDOW.x + WINDOW.w + 30}`} stroke="#9aa0a6" strokeWidth={2} opacity={0.6} />
        </g>
      ) : (
        Array.from({ length: 8 }, (_, i) => <rect key={i} x={WINDOW.x - 20 + i * 96} y={462} width={48} height={3} fill="#f3efe6" opacity={0.5} />)
      )}
      {d.style === "kissaten" && Array.from({ length: 7 }, (_, i) => <rect key={`z${i}`} x={560 + i * 18} y={440} width={10} height={50} fill="#f3efe6" opacity={0.45} />)}
      {/* The near pavement, right outside the glass. */}
      <rect x={WINDOW.x - 30} y={KERB} width={WINDOW.w + 60} height={50} fill={lighten(model.palette.street, 0.18)} />
      <rect x={WINDOW.x - 30} y={KERB} width={WINDOW.w + 60} height={4} fill={lighten(model.palette.street, 0.35)} />
      {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M ${WINDOW.x - 30 + i * 64} ${KERB + 4} l -10 40`} stroke={darken(model.palette.street, 0.1)} strokeWidth={1.4} opacity={0.5} />)}
      {wet && (
        <g>
          {[140, 330, 590].map((x, i) => (
            <rect key={i} x={x} y={BASELINE + 4} width={36} height={KERB - BASELINE - 6} fill={dark ? "#ffd27a" : "#dfe7ef"} opacity={0.18} />
          ))}
          {[180, 420, 660].map((x, i) => (
            <ellipse key={`p${i}`} cx={x} cy={KERB + 24 + (i % 2) * 6} rx={46} ry={5} fill={lighten(model.palette.skyBottom, 0.2)} opacity={0.4} />
          ))}
        </g>
      )}
    </Prop>
  );
}

function Wires({ model }: { model: SceneModel }) {
  const style = model.sign.decor.style;
  if (style === "laneway") {
    const lit = model.time === "dusk" || model.time === "night";
    return (
      <g>
        <Prop name="tram-wires">
          <line x1={WINDOW.x - 30} y1={180} x2={WINDOW.x + WINDOW.w + 30} y2={186} stroke="#2a2d33" strokeWidth={2} />
          <line x1={WINDOW.x - 30} y1={192} x2={WINDOW.x + WINDOW.w + 30} y2={196} stroke="#2a2d33" strokeWidth={1.5} />
        </Prop>
        <Prop name="lane-festoons">
          {[0, 1].map((k) => (
            <g key={k}>
              <path d={`M ${WINDOW.x - 30} ${226 + k * 30} Q 420 ${270 + k * 30} ${WINDOW.x + WINDOW.w + 30} ${220 + k * 30}`} fill="none" stroke="#2a2320" strokeWidth={1.2} />
              {Array.from({ length: 13 }, (_, i) => {
                const u = i / 12;
                const x = WINDOW.x - 30 + u * (WINDOW.w + 60);
                const y = (1 - u) * (1 - u) * (226 + k * 30) + 2 * u * (1 - u) * (270 + k * 30) + u * u * (220 + k * 30);
                return <circle key={i} cx={x} cy={y + 3} r={lit ? 3 : 2.2} fill={lit ? "#ffe2a0" : "#f3efe6"} opacity={lit ? 1 : 0.7} />;
              })}
            </g>
          ))}
        </Prop>
      </g>
    );
  }
  const px = style === "kissaten" ? 520 : 250;
  return (
    <Prop name="power-lines">
      {/* A utility pole: two offset arms with insulators and a transformer can. */}
      <rect x={px} y={100} width={8} height={KERB - 100} fill="#5a5550" />
      <rect x={px - 6} y={156} width={30} height={4} fill="#4a4540" />
      <rect x={px - 18} y={176} width={34} height={4} fill="#4a4540" />
      {[px - 4, px + 8, px + 20, px - 16, px + 12].map((x, i) => (
        <rect key={i} x={x} y={i < 3 ? 150 : 170} width={3} height={6} fill="#dfe3e6" />
      ))}
      <rect x={px + 8} y={196} width={18} height={30} rx={4} fill="#8a8a80" />
      <rect x={px + 8} y={196} width={5} height={30} rx={2} fill="#ffffff" opacity={0.2} />
      {[0, 1, 2, 3].map((k) => (
        <path key={k} d={`M ${WINDOW.x - 30} ${150 + k * 9} Q 300 ${190 + k * 12} ${WINDOW.x + WINDOW.w + 30} ${158 + k * 7}`} fill="none" stroke="#2a2d33" strokeWidth={1.2} />
      ))}
      {style === "kopi" && <path d="M 240 176 q 30 40 10 70 q -20 20 20 40" fill="none" stroke="#2a2d33" strokeWidth={1.2} />}
    </Prop>
  );
}

function StreetLamp({ model }: { model: SceneModel }) {
  const on = model.time !== "afternoon" && model.time !== "morning";
  return (
    <Prop name="street-lamp">
      <rect x={712} y={236} width={6} height={KERB + 8 - 236} fill="#2a2d33" />
      <path d="M 715 240 Q 715 222 690 222 L 680 222" fill="none" stroke="#2a2d33" strokeWidth={5} />
      <path d="M 666 222 L 694 222 L 688 232 L 672 232 Z" fill="#2a2d33" />
      <ellipse cx={680} cy={233} rx={8} ry={3} fill={on ? "#fff2c8" : "#cfd4d8"} />
      {on && <circle cx={680} cy={236} r={36} fill="url(#cf-bokeh-warm)" opacity={0.8} />}
      {on && <path d={`M 672 236 L 630 ${KERB} L 730 ${KERB} Z`} fill="#fff2c8" opacity={0.08} />}
    </Prop>
  );
}

/** Someone on the pavement; they carry an umbrella in the rain (and a parasol in the tropics' sun). */
function Walker({ y, umbrella, coat, canopy, className, bag }: { y: number; umbrella: "open" | "closed" | null; coat: string; canopy: string; className: string; bag?: string }) {
  return (
    <g className={`particle walker ${className}`}>
      <g transform={`translate(0 ${y})`}>
        <ellipse cx={0} cy={12} rx={16} ry={3} fill="#000000" opacity={0.25} />
        <circle cx={0} cy={-46} r={8} fill="#2a2320" />
        <path d="M -9 -36 Q 0 -40 9 -36 L 10 -4 L -10 -4 Z" fill={coat} />
        <path d="M 2 -38 Q 9 -37 9 -36 L 10 -4 L 3 -4 Z" fill="#000000" opacity={0.2} />
        <rect x={-7} y={-6} width={5} height={17} rx={2} fill="#2a2320" />
        <rect x={2} y={-6} width={5} height={17} rx={2} fill="#2a2320" />
        {bag && <rect x={-16} y={-24} width={10} height={14} rx={2} fill={bag} />}
        {umbrella === "open" && (
          <g>
            <line x1={9} y1={-30} x2={9} y2={-68} stroke="#2a2320" strokeWidth={2} />
            <path d="M -22 -66 Q 9 -98 40 -66 Q 32 -70 24 -66 Q 17 -71 9 -66 Q 1 -71 -6 -66 Q -14 -70 -22 -66 Z" fill={canopy} />
            <path d="M 9 -90 L -6 -66 M 9 -90 L 24 -66" stroke="#000000" strokeOpacity={0.2} strokeWidth={1} />
          </g>
        )}
        {umbrella === "closed" && <line x1={11} y1={-28} x2={15} y2={10} stroke={canopy} strokeWidth={4} strokeLinecap="round" />}
      </g>
    </g>
  );
}

function Tram() {
  return (
    <Prop name="tram" className="prop-tram">
      <g className="tram">
        <rect x={0} y={336} width={380} height={96} rx={14} fill="#2e7d4f" />
        <rect x={0} y={336} width={380} height={20} rx={10} fill="#f2efe6" />
        <rect x={0} y={412} width={380} height={12} fill="#1f5a38" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <g key={i}>
            <rect x={20 + i * 58} y={360} width={44} height={36} rx={5} fill="#cfe3ee" opacity={0.9} />
            <circle cx={36 + i * 58} cy={384} r={7} fill="#3a3f47" opacity={0.7} />
            <rect x={30 + i * 58} y={389} width={14} height={8} rx={3} fill="#3a3f47" opacity={0.7} />
          </g>
        ))}
        <rect x={352} y={360} width={20} height={20} rx={3} fill="#1f1c1a" />
        <text x={362} y={375} textAnchor="middle" fontFamily={FONT} fontSize={11} fontWeight={700} fill="#ffd27a">
          86
        </text>
        <circle cx={372} cy={404} r={4} fill="#fff2c8" />
        <path d="M 190 336 L 196 190 M 180 336 L 204 300 L 186 280" fill="none" stroke="#2a2d33" strokeWidth={2} />
      </g>
    </Prop>
  );
}

function Vending({ model }: { model: SceneModel }) {
  return (
    <Prop name="vending-machine" className="prop-vending">
      <rect x={618} y={392} width={82} height={108} rx={4} fill="#d9dde3" />
      <rect x={618} y={392} width={16} height={108} fill="#000000" opacity={0.08} />
      <rect className="vending-glow" x={626} y={400} width={66} height={56} fill="#bfe6ff" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={630 + i * 15} y={404} width={11} height={18} rx={3} fill={["#c2463a", "#3b7d4f", "#e0a43a", "#3b6ea5"][i]} />
          <rect x={630 + i * 15} y={428} width={11} height={18} rx={3} fill={["#e0a43a", "#3b6ea5", "#c2463a", "#f3efe6"][i]} />
        </g>
      ))}
      <rect x={632} y={466} width={50} height={14} rx={2} fill="#39404c" />
      <rect x={684} y={462} width={8} height={12} rx={2} fill="#39404c" />
      <circle cx={660} cy={430} r={60} fill="url(#cf-bokeh-cyan)" opacity={model.time === "night" || model.time === "dusk" ? 0.7 : 0.25} />
      {/* Umbrellas left in the stand outside. */}
      <rect x={596} y={470} width={18} height={30} rx={3} fill="#5a5550" />
      {["#dfe7ef", "#2f4858", "#c2463a"].map((c, i) => (
        <line key={i} x1={600 + i * 5} y1={470} x2={598 + i * 6} y2={436 + i * 4} stroke={c} strokeWidth={4} strokeLinecap="round" />
      ))}
    </Prop>
  );
}

function Taxi() {
  return (
    <Prop name="taxi" className="car-drive">
      <g transform={`translate(0 ${BASELINE + 32})`}>
        <path d="M 0 -18 L 16 -18 L 30 -36 L 84 -36 L 100 -18 L 118 -16 L 118 0 L 0 0 Z" fill="#e8d44a" />
        <path d="M 34 -33 L 56 -33 L 56 -20 L 22 -20 Z M 60 -33 L 82 -33 L 94 -20 L 60 -20 Z" fill="#9fb8c8" />
        <rect x={50} y={-44} width={20} height={8} rx={2} fill="#f3efe6" />
        <circle cx={24} cy={0} r={10} fill="#1f1c1a" />
        <circle cx={96} cy={0} r={10} fill="#1f1c1a" />
        <circle cx={24} cy={0} r={4} fill="#9aa0a6" />
        <circle cx={96} cy={0} r={4} fill="#9aa0a6" />
        <rect x={112} y={-14} width={6} height={5} fill="#fff2c8" />
      </g>
    </Prop>
  );
}

function Scooter({ className, jacket, helmet, passenger, name, x = 0 }: { className: string; jacket: string; helmet: string; passenger?: string; name: string; x?: number }) {
  return (
    <Prop name={name} className={`${className} mover`}>
      <g transform={`translate(${x} ${BASELINE + 40})`}>
        <path d="M 6 -22 L 30 -22 L 46 -40 L 58 -40 L 62 -22 L 72 -22 L 70 -12 L 4 -12 Z" fill="#e0a43a" />
        <path d="M 10 -22 L 40 -22 L 38 -16 L 8 -16 Z" fill="#ffffff" opacity={0.25} />
        <circle cx={12} cy={-8} r={9} fill="#222" />
        <circle cx={64} cy={-8} r={9} fill="#222" />
        <circle cx={12} cy={-8} r={3.5} fill="#8a8f96" />
        <circle cx={64} cy={-8} r={3.5} fill="#8a8f96" />
        <circle cx={40} cy={-66} r={9} fill={helmet} />
        <path d="M 32 -66 L 48 -66 L 46 -60 L 34 -60 Z" fill="#1f2328" opacity={0.6} />
        <path d="M 30 -56 Q 40 -60 50 -54 L 48 -28 L 30 -28 Z" fill={jacket} />
        <path d="M 46 -48 L 60 -38" stroke={jacket} strokeWidth={6} strokeLinecap="round" />
        {passenger && (
          <g>
            <circle cx={20} cy={-62} r={8.5} fill={passenger} />
            <path d="M 12 -52 Q 20 -56 28 -50 L 28 -26 L 12 -26 Z" fill="#6b8f71" />
          </g>
        )}
      </g>
    </Prop>
  );
}

function Becak() {
  return (
    <Prop name="becak" className="prop-becak mover">
      <g transform={`translate(0 ${BASELINE + 36})`}>
        <path d="M 0 -64 Q 32 -94 66 -64 L 66 -32 L 0 -32 Z" fill="#c2463a" />
        <path d="M 4 -64 Q 32 -88 62 -64" fill="none" stroke="#ffe7b0" strokeWidth={2} />
        <rect x={4} y={-36} width={58} height={16} rx={4} fill="#3b6ea5" />
        <path d="M 8 -34 l 10 12 l 10 -12 l 10 12 l 10 -12 l 10 12" fill="none" stroke="#ffe7b0" strokeWidth={1.4} />
        <circle cx={10} cy={-10} r={10} fill="none" stroke="#222" strokeWidth={3} />
        <circle cx={56} cy={-10} r={10} fill="none" stroke="#222" strokeWidth={3} />
        <line x1={62} y1={-26} x2={98} y2={-12} stroke="#222" strokeWidth={3} />
        <circle cx={100} cy={-10} r={10} fill="none" stroke="#222" strokeWidth={3} />
        <circle cx={86} cy={-62} r={7} fill="#2a2320" />
        <path d="M 76 -70 Q 86 -78 96 -70 Z" fill="#c9a26b" />
        <rect x={80} y={-55} width={12} height={24} rx={4} fill="#e6d3a3" />
      </g>
    </Prop>
  );
}

function Car({ model }: { model: SceneModel }) {
  return (
    <Prop name="car" className="car-drive">
      <g transform={`translate(0 ${BASELINE + 36})`}>
        <path d="M 0 -16 L 20 -18 L 36 -34 L 86 -34 L 104 -18 L 124 -14 L 124 0 L 0 0 Z" fill={model.sign.decor.style === "laneway" ? "#3b6ea5" : "#c9ccd2"} />
        <path d="M 40 -31 L 60 -31 L 60 -20 L 28 -20 Z M 64 -31 L 84 -31 L 98 -20 L 64 -20 Z" fill="#9fb8c8" opacity={0.9} />
        <circle cx={26} cy={0} r={10} fill="#1f1c1a" />
        <circle cx={100} cy={0} r={10} fill="#1f1c1a" />
        <rect x={118} y={-12} width={6} height={5} fill="#fff2c8" />
      </g>
    </Prop>
  );
}

/** Things parked or standing on the near pavement: the city's own clutter. */
function Pavement({ model }: { model: SceneModel }) {
  const style = model.sign.decor.style;
  if (style === "kissaten")
    return (
      <Prop name="bicycles">
        {[120, 170].map((x, i) => (
          <g key={x} transform={`translate(${x} ${KERB + 30})`}>
            <circle cx={0} cy={0} r={13} fill="none" stroke="#2a2d33" strokeWidth={2.4} />
            <circle cx={40} cy={0} r={13} fill="none" stroke="#2a2d33" strokeWidth={2.4} />
            <path d="M 0 0 L 16 -22 L 34 -22 L 40 0 M 16 -22 L 20 0 L 34 -22 M 34 -22 L 32 -30" fill="none" stroke={i ? "#c2463a" : "#3b6ea5"} strokeWidth={2.6} />
            <rect x={36} y={-26} width={16} height={10} rx={2} fill="#9aa0a6" />
          </g>
        ))}
      </Prop>
    );
  if (style === "kopi")
    return (
      <Prop name="food-cart">
        <g transform={`translate(110 ${KERB + 30})`}>
          <rect x={0} y={-60} width={110} height={50} rx={4} fill="#3f8a5a" />
          <rect x={6} y={-54} width={98} height={22} fill="#dfeee6" opacity={0.85} />
          <text x={55} y={-38} textAnchor="middle" fontFamily={FONT} fontSize={10} fontWeight={700} fill="#c2463a">
            NASI GORENG
          </text>
          <rect x={-4} y={-90} width={118} height={8} fill="#c2463a" />
          <line x1={4} y1={-82} x2={4} y2={-60} stroke="#5a5550" strokeWidth={3} />
          <line x1={106} y1={-82} x2={106} y2={-60} stroke="#5a5550" strokeWidth={3} />
          <circle cx={22} cy={-4} r={9} fill="#222" />
          <circle cx={88} cy={-4} r={9} fill="#222" />
          <circle cx={80} cy={-70} r={30} fill="url(#cf-bokeh-warm)" opacity={0.6} />
        </g>
      </Prop>
    );
  if (style === "joglo")
    return (
      <Prop name="angkringan-cart">
        <g transform={`translate(110 ${KERB + 30})`}>
          <path d="M -10 -86 L 120 -86 L 110 -70 L 0 -70 Z" fill="#2f3f6e" />
          <rect x={4} y={-68} width={100} height={48} fill="#8a5a3b" />
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={16 + i * 18} cy={-58} r={6} fill="#e6d3a3" />
          ))}
          <circle cx={90} cy={-76} r={4} fill="#ffcf6a" />
          <circle cx={90} cy={-76} r={26} fill="url(#cf-bokeh-warm)" opacity={0.7} />
          <circle cx={20} cy={-8} r={11} fill="none" stroke="#222" strokeWidth={3} />
          <circle cx={88} cy={-8} r={11} fill="none" stroke="#222" strokeWidth={3} />
        </g>
      </Prop>
    );
  return (
    <Prop name="sandwich-board">
      <g transform={`translate(120 ${KERB + 34})`}>
        <path d="M 0 0 L 12 -48 L 36 -48 L 48 0" fill="#2a2d33" />
        <rect x={10} y={-44} width={28} height={36} fill="#23262b" />
        <path d="M 14 -36 h 20 M 14 -28 h 16 M 14 -20 h 18" stroke="#f3e7cf" strokeWidth={1.4} opacity={0.8} />
        <g transform="translate(90 0)">
          <rect x={-4} y={-42} width={40} height={4} rx={2} fill="#1f1c1a" />
          <line x1={16} y1={-40} x2={16} y2={0} stroke="#1f1c1a" strokeWidth={3} />
          <path d="M 0 -12 L 32 -12" stroke="#1f1c1a" strokeWidth={2} />
        </g>
      </g>
    </Prop>
  );
}

function Traffic({ model }: { model: SceneModel }) {
  const style = model.sign.decor.style;
  const out: ReactNode[] = [];
  if (style === "laneway") out.push(<Tram key="tram" />, <Car key="car" model={model} />);
  if (style === "kissaten") out.push(<Taxi key="taxi" />);
  if (style === "kopi")
    out.push(
      <Scooter key="a" name="ojek-rider" className="prop-scooter" jacket="#2f7d4f" helmet="#2f7d4f" passenger="#1f1a17" />,
      <Scooter key="b" name="ojek-rider-2" className="scooter-b" jacket="#3b6ea5" helmet="#c2463a" />,
    );
  if (style === "joglo") out.push(<Becak key="becak" />, <Scooter key="s" name="scooter" className="scooter-b" jacket="#8a5a3b" helmet="#f3efe6" />);
  return <>{out}</>;
}

/** Everything seen through the window: sky, the city, its traffic, people and the rain. */
export const Street = memo(function Street({ model }: { model: SceneModel }) {
  const { weather, time } = model;
  const raining = weather === "rain";
  const tropical = model.sign.decor.style === "kopi" || model.sign.decor.style === "joglo";
  const dark = time === "dusk" || time === "night";
  return (
    <g className="street" data-layer="street">
      <defs>
        <clipPath id="cafe-window">
          <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} />
        </clipPath>
      </defs>
      <g clipPath="url(#cafe-window)">
        {/* Parallax moves the view inside a fixed window, so the frame never shows a gap. */}
        <g className="layer-far">
          <Sky model={model} />
          <Horizon model={model} />
          <Skyline model={model} />
          <Wires model={model} />
          <Shopfronts model={model} />
          <Road model={model} />
          <Pavement model={model} />
          <Traffic model={model} />
          <Walkers model={model} raining={raining} tropical={tropical} />
          {/* The street sinks into the evening; then its lights are drawn again on top. */}
          <rect x={WINDOW.x - 30} y={WINDOW.y - 30} width={WINDOW.w + 60} height={WINDOW.h + 60} fill="url(#cf-street-shade)" />
          <Skyline model={model} glow />
          <StreetGlow model={model} />
          <StreetLamp model={model} />
          {model.sign.decor.style === "kissaten" && <Vending model={model} />}
          {dark && <ellipse className="particle headlights" cx={0} cy={BASELINE + 30} rx={60} ry={18} fill="#fff6d8" opacity={0.3} />}
          {raining &&
            Array.from({ length: RAIN_DROPS }, (_, i) => {
              const x = WINDOW.x + ((i * 97) % WINDOW.w);
              const y = WINDOW.y - 40 + ((i * 53) % 120);
              return (
                <line
                  key={i}
                  className="particle rain-drop"
                  x1={x}
                  y1={y}
                  x2={x - 4}
                  y2={y + 22}
                  stroke="#dfe7ef"
                  strokeWidth={1.4}
                  opacity={0.35}
                  style={{ animationDuration: `${0.7 + ((i * 13) % 50) / 100}s`, animationDelay: `${-((i * 29) % 100) / 100}s` }}
                />
              );
            })}
        </g>
      </g>
    </g>
  );
});

function Walkers({ model, raining, tropical }: { model: SceneModel; raining: boolean; tropical: boolean }) {
  return (
          <Prop name="pedestrians">
            <Walker y={KERB + 26} umbrella={raining ? "open" : "closed"} coat="#4a6b8a" canopy={raining ? "#c2463a" : "#2f4858"} className="walker-a" bag="#e0a43a" />
            <Walker y={KERB + 34} umbrella={raining || tropical ? "open" : null} coat="#8a5a4a" canopy={model.sign.decor.style === "kissaten" ? "#dfe7ef" : tropical && !raining ? "#e0a43a" : "#2f4858"} className="walker-b" />
            {raining && <Walker y={KERB + 18} umbrella="open" coat="#5a6b4a" canopy={model.sign.decor.style === "kissaten" ? "#e8eef2" : "#3b6ea5"} className="walker-c" />}
          </Prop>
  );
}
