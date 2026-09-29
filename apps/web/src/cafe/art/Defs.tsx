import { mix, type SceneModel } from "@pitwall/world";
import { memo } from "react";
import { darken, lighten, rnd, toner } from "./kit";

const mixDark = (a: string, b: string) => mix(a, b, 0.5);

/**
 * Every gradient and pattern the café shares, defined once (M2.5 spec §12): surfaces reference
 * these instead of carrying their own filters, which keeps camera moves cheap.
 */
export const Defs = memo(function Defs({ model }: { model: SceneModel }) {
  const { palette } = model;
  const d = model.sign.decor;
  const t = toner(model);
  const [wl, wd] = d.wall;
  const [fl, fd] = d.floor;
  return (
    <defs>
      <linearGradient id="cf-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.skyTop} />
        <stop offset="1" stopColor={palette.skyBottom} />
      </linearGradient>
      <radialGradient id="cf-glow">
        <stop offset="0" stopColor={palette.lamp} stopOpacity={0.9} />
        <stop offset="0.35" stopColor={palette.lamp} stopOpacity={0.35} />
        <stop offset="1" stopColor={palette.lamp} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="cf-glow-soft">
        <stop offset="0" stopColor={palette.lamp} stopOpacity={0.45} />
        <stop offset="1" stopColor={palette.lamp} stopOpacity={0} />
      </radialGradient>
      <radialGradient id="cf-shadow">
        <stop offset="0" stopColor="#000000" stopOpacity={0.55} />
        <stop offset="0.6" stopColor="#000000" stopOpacity={0.2} />
        <stop offset="1" stopColor="#000000" stopOpacity={0} />
      </radialGradient>
      <radialGradient id="cf-screen-glow">
        <stop offset="0" stopColor="#cfe0ff" stopOpacity={0.55} />
        <stop offset="1" stopColor="#cfe0ff" stopOpacity={0} />
      </radialGradient>
      {(
        [
          ["l", "1", "0", "0", "0"],
          ["r", "0", "0", "1", "0"],
          ["b", "0", "0", "0", "1"],
        ] as const
      ).map(([id, x1, y1, x2, y2]) => (
        <linearGradient key={id} id={`cf-edge-${id}`} x1={x1} y1={y1} x2={x2} y2={y2}>
          <stop offset="0" stopColor="#000000" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.4} />
        </linearGradient>
      ))}
      {(
        [
          ["warm", "#ffd9a0"],
          ["glow", d.glow],
          ["accent", d.accent],
          ["red", "#ff6b5a"],
          ["cyan", "#8fe8ff"],
          ["white", "#fff6e6"],
        ] as const
      ).map(([id, c]) => (
        <radialGradient key={id} id={`cf-bokeh-${id}`}>
          <stop offset="0" stopColor={lighten(c, 0.4)} stopOpacity={0.9} />
          <stop offset="0.55" stopColor={c} stopOpacity={0.5} />
          <stop offset="0.8" stopColor={c} stopOpacity={0.35} />
          <stop offset="1" stopColor={c} stopOpacity={0} />
        </radialGradient>
      ))}
      <linearGradient id="cf-fog" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#eef2f5" stopOpacity={palette.fog * 0.3} />
        <stop offset="0.6" stopColor="#eef2f5" stopOpacity={palette.fog * 0.8} />
        <stop offset="1" stopColor="#eef2f5" stopOpacity={palette.fog * 1.5} />
      </linearGradient>
      <linearGradient id="cf-daylight" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#fff4dc" stopOpacity={palette.daylight * 0.5} />
        <stop offset="1" stopColor="#fff4dc" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="cf-ceiling-shadow" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity={0.45} />
        <stop offset="1" stopColor="#000000" stopOpacity={0} />
      </linearGradient>
      <linearGradient id="cf-wall-light" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity={0.35} />
        <stop offset="0.35" stopColor="#000000" stopOpacity={0.05} />
        <stop offset="0.8" stopColor="#000000" stopOpacity={0.12} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.3} />
      </linearGradient>
      <linearGradient id="cf-floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={t(fd, 1.3)} />
        <stop offset="1" stopColor={t(fl, 1.1)} />
      </linearGradient>
      <linearGradient id="cf-table" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={t(darken(palette.wood, 0.1), 0.9)} />
        <stop offset="0.5" stopColor={t(palette.wood, 0.8)} />
        <stop offset="1" stopColor={t(darken(palette.wood, 0.25), 0.9)} />
      </linearGradient>
      <linearGradient id="cf-wood" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={t(lighten(palette.wood, 0.1))} />
        <stop offset="1" stopColor={t(palette.woodDark)} />
      </linearGradient>
      <linearGradient id="cf-trim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={t(lighten(d.trim, 0.12))} />
        <stop offset="0.5" stopColor={t(lighten(d.trim, 0.25))} />
        <stop offset="1" stopColor={t(d.trim)} />
      </linearGradient>
      <linearGradient id="cf-trim-v" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={t(lighten(d.trim, 0.3))} />
        <stop offset="1" stopColor={t(d.trim)} />
      </linearGradient>
      <linearGradient id="cf-chrome" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor={t("#8b939c")} />
        <stop offset="0.25" stopColor={t("#e9eef2")} />
        <stop offset="0.55" stopColor={t("#a8b0b8")} />
        <stop offset="0.8" stopColor={t("#dfe5ea")} />
        <stop offset="1" stopColor={t("#7d858e")} />
      </linearGradient>
      <linearGradient id="cf-graphite" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#3a3f47" />
        <stop offset="1" stopColor="#1a1d22" />
      </linearGradient>
      <linearGradient id="cf-deck" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={t("#9aa1aa", 0.8)} />
        <stop offset="1" stopColor={t("#c9ced4", 0.8)} />
      </linearGradient>
      <linearGradient id="cf-counter" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#000000" stopOpacity={0.05} />
        <stop offset="1" stopColor="#000000" stopOpacity={0.45} />
      </linearGradient>
      <linearGradient id="cf-glass" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
        <stop offset="0.5" stopColor="#ffffff" stopOpacity={0.08} />
        <stop offset="1" stopColor="#ffffff" stopOpacity={0.2} />
      </linearGradient>
      <linearGradient id="cf-wallpaper" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2b2f6b" />
        <stop offset="0.55" stopColor="#c0587a" />
        <stop offset="1" stopColor="#f3a86a" />
      </linearGradient>
      <linearGradient id="cf-street" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={darken(palette.street, 0.15)} />
        <stop offset="1" stopColor={lighten(palette.street, 0.08)} />
      </linearGradient>
      {/* The street's evening: nothing at the sky's top, the full shade by the rooftops. */}
      <linearGradient id="cf-street-shade" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.shade} stopOpacity={0} />
        <stop offset="0.4" stopColor={palette.shade} stopOpacity={Math.min(0.8, palette.shadeOpacity * 1.4)} />
        <stop offset="1" stopColor={palette.shade} stopOpacity={Math.min(0.85, palette.shadeOpacity * 1.6)} />
      </linearGradient>
      <linearGradient id="cf-haze" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={palette.skyBottom} stopOpacity={0} />
        <stop offset="1" stopColor={palette.skyBottom} stopOpacity={0.55} />
      </linearGradient>
      <WallPattern model={model} light={t(wl)} dark={t(wd)} />
      <FloorPattern model={model} light={fl} dark={fd} t={t} />
      <pattern id="cf-grain" width="160" height="40" patternUnits="userSpaceOnUse">
        {Array.from({ length: 9 }, (_, i) => (
          <path
            key={i}
            d={`M 0 ${3 + i * 4.3} Q 40 ${1 + i * 4.3 + rnd(i) * 3} 80 ${3 + i * 4.3} T 160 ${3 + i * 4.3}`}
            fill="none"
            stroke={i % 3 ? "#000000" : "#ffffff"}
            strokeOpacity={i % 3 ? 0.08 : 0.06}
            strokeWidth={i % 2 ? 1 : 1.6}
          />
        ))}
      </pattern>
      {/* Kawung: four ovals round a dot, the oldest batik motif. */}
      <pattern id="cf-batik" width="24" height="24" patternUnits="userSpaceOnUse">
        {[0, 90, 180, 270].map((a) => (
          <ellipse key={a} cx={12} cy={5.5} rx={3.6} ry={5.5} fill="#e8d4a8" opacity={0.85} transform={`rotate(${a} 12 12)`} />
        ))}
        <circle cx={12} cy={12} r={1.6} fill="#1f1a17" />
        <circle cx={0} cy={0} r={2.4} fill="#e8d4a8" opacity={0.7} />
        <circle cx={24} cy={24} r={2.4} fill="#e8d4a8" opacity={0.7} />
        <circle cx={24} cy={0} r={2.4} fill="#e8d4a8" opacity={0.7} />
        <circle cx={0} cy={24} r={2.4} fill="#e8d4a8" opacity={0.7} />
      </pattern>
      {/* Film grain: its bitmap is filled in at runtime (useGrain). */}
      <pattern id="cf-noise" width="160" height="160" patternUnits="userSpaceOnUse">
        <image width="160" height="160" />
      </pattern>
      <pattern id="cf-stripes" width="24" height="10" patternUnits="userSpaceOnUse">
        <rect width="12" height="10" fill="#ffffff" opacity={0.5} />
      </pattern>
    </defs>
  );
});

/** The back wall's material: brick, dark wood slats, polished concrete or carved teak. */
function WallPattern({ model, light, dark }: { model: SceneModel; light: string; dark: string }) {
  const style = model.sign.decor.style;
  if (style === "laneway") {
    const shades = [light, dark, lighten(light, 0.08), darken(light, 0.12), mixDark(light, dark)];
    return (
      <pattern id="cf-wall-tex" width="96" height="48" patternUnits="userSpaceOnUse">
        <rect width="96" height="48" fill={darken(dark, 0.3)} />
        {[0, 1, 2, 3].flatMap((row) =>
          [0, 1, 2, 3, 4].map((col) => {
            const odd = row % 2 === 1;
            const x = col * 24 - (odd ? 12 : 0);
            // The half brick at each edge is the same brick, so the tile repeats without a seam.
            const c = shades[Math.floor(rnd(row * 5 + (odd && col === 4 ? 0 : col)) * shades.length)]!;
            return (
              <g key={`${row}-${col}`}>
                <rect x={x + 1} y={row * 12 + 1} width={22} height={10} rx={1.5} fill={c} />
                <rect x={x + 1} y={row * 12 + 1} width={22} height={2} fill="#ffffff" opacity={0.07} />
              </g>
            );
          }),
        )}
      </pattern>
    );
  }
  if (style === "kissaten") {
    return (
      <pattern id="cf-wall-tex" width="44" height="200" patternUnits="userSpaceOnUse">
        <rect width="44" height="200" fill={dark} />
        <rect x={2} width="18" height="200" fill={light} />
        <rect x={23} width="19" height="200" fill={darken(light, 0.1)} />
        {[20, 70, 130, 170].map((y, i) => (
          <path key={y} d={`M ${4 + i * 3} ${y} q 4 18 0 36`} fill="none" stroke={dark} strokeOpacity={0.35} strokeWidth={1} />
        ))}
        <rect x={2} width="2" height="200" fill="#ffffff" opacity={0.06} />
      </pattern>
    );
  }
  if (style === "kopi") {
    return (
      <pattern id="cf-wall-tex" width="160" height="80" patternUnits="userSpaceOnUse">
        <rect width="160" height="80" fill={light} />
        <rect x={0} y={0} width={80} height={80} fill={darken(light, 0.04)} />
        <rect x={80} y={40} width={80} height={40} fill={lighten(light, 0.04)} />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <ellipse key={i} cx={rnd(i + 20) * 160} cy={rnd(i + 30) * 80} rx={10 + rnd(i) * 18} ry={6 + rnd(i + 5) * 10} fill={dark} opacity={0.12} />
        ))}
        <circle cx={40} cy={40} r={2.4} fill={darken(dark, 0.3)} />
        <circle cx={120} cy={40} r={2.4} fill={darken(dark, 0.3)} />
        <path d="M 0 0 H 160 M 0 0 V 80 M 80 0 V 80" stroke={darken(light, 0.15)} strokeWidth={1.2} />
      </pattern>
    );
  }
  // Joglo: teak boards with a carved band.
  return (
    <pattern id="cf-wall-tex" width="120" height="60" patternUnits="userSpaceOnUse">
      <rect width="120" height="60" fill={light} />
      <rect y="0" width="120" height="19" fill={darken(light, 0.06)} />
      <rect y="40" width="120" height="20" fill={lighten(light, 0.05)} />
      <path d="M 0 19.5 H 120 M 0 40 H 120" stroke={dark} strokeWidth={1.5} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${i * 40 + 6} 29 q 7 -8 14 0 t 14 0`} fill="none" stroke={dark} strokeOpacity={0.5} strokeWidth={1.4} />
      ))}
      <path d="M 10 8 q 30 3 60 -1 T 118 6 M 6 50 q 40 -3 70 1 T 120 50" fill="none" stroke={dark} strokeOpacity={0.25} strokeWidth={1} />
    </pattern>
  );
}

/** The floor: old boards, dark kissaten wood, terrazzo, or patterned tegel tiles. */
function FloorPattern({ model, light, dark, t }: { model: SceneModel; light: string; dark: string; t: (c: string, k?: number) => string }) {
  const style = model.sign.decor.style;
  const l = t(light, 1.2);
  const k = t(dark, 1.2);
  if (style === "kopi") {
    return (
      <pattern id="cf-floor-tex" width="90" height="40" patternUnits="userSpaceOnUse">
        <rect width="90" height="40" fill={l} />
        {Array.from({ length: 22 }, (_, i) => (
          <circle key={i} cx={rnd(i + 40) * 90} cy={rnd(i + 70) * 40} r={0.8 + rnd(i + 90) * 1.8} fill={[k, "#7c8a8a", "#b86a4a", "#ffffff"][i % 4]} opacity={0.7} />
        ))}
      </pattern>
    );
  }
  if (style === "joglo") {
    return (
      <pattern id="cf-floor-tex" width="60" height="24" patternUnits="userSpaceOnUse">
        <rect width="60" height="24" fill={l} />
        <rect width="30" height="12" fill={k} opacity={0.35} />
        <rect x="30" y="12" width="30" height="12" fill={k} opacity={0.35} />
        <path d="M 15 2 L 22 6 L 15 10 L 8 6 Z M 45 14 L 52 18 L 45 22 L 38 18 Z" fill={t("#8a3a24", 1.2)} opacity={0.6} />
        <path d="M 0 0 H 60 M 0 12 H 60 M 0 0 V 24 M 30 0 V 24" stroke={k} strokeWidth={0.8} />
      </pattern>
    );
  }
  return (
    <pattern id="cf-floor-tex" width="180" height="18" patternUnits="userSpaceOnUse">
      <rect width="180" height="18" fill={l} />
      <rect width="180" height="9" fill={k} opacity={0.25} />
      <path d="M 0 0 H 180 M 0 9 H 180 M 60 0 V 9 M 140 0 V 9 M 20 9 V 18 M 110 9 V 18" stroke={darken(k, 0.3)} strokeWidth={1} />
      <path d="M 70 4 q 20 -2 40 1 M 10 13 q 30 2 60 -1" fill="none" stroke={darken(k, 0.2)} strokeOpacity={0.4} strokeWidth={0.8} />
    </pattern>
  );
}
