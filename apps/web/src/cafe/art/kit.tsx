import { mix, type SceneModel } from "@pitwall/world";
import type { ReactNode } from "react";

/**
 * The café's shared drawing kit (M2.5 spec §12): lo-fi illustration, so every surface gets a
 * gradient, soft shadows are gradients (never blur filters), and light is laid on as glows.
 */

export const FONT = "IBM Plex Sans, sans-serif";
export const MONO = "IBM Plex Mono, monospace";

/** A fixed pseudo-random 0–1 per index, so the same café is drawn the same way every time. */
export function rnd(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** Colours for the time of day: the room sinks towards the palette's shade as the light goes. */
export function toner(model: SceneModel): (c: string, k?: number) => string {
  const { shade, shadeOpacity } = model.palette;
  return (c, k = 1) => mix(c, shade, Math.min(0.9, shadeOpacity * k));
}

export const lighten = (c: string, t: number) => mix(c, "#ffffff", t);
export const darken = (c: string, t: number) => mix(c, "#000000", t);

/** A soft contact shadow under something resting on a surface. */
export function Shadow({ cx, cy, rx, ry, o = 0.5 }: { cx: number; cy: number; rx: number; ry: number; o?: number }) {
  return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="url(#cf-shadow)" opacity={o} />;
}

/** A pool of warm light. */
export function Glow({ cx, cy, r, ry, o = 1, fill = "url(#cf-glow)", className }: { cx: number; cy: number; r: number; ry?: number; o?: number; fill?: string; className?: string }) {
  return <ellipse className={className} cx={cx} cy={cy} rx={r} ry={ry ?? r} fill={fill} opacity={o} />;
}

/** A named prop: a test counts these (M2.5 spec §12). */
export function Prop({ name, children, className, transform }: { name: string; children: ReactNode; className?: string; transform?: string }) {
  return (
    <g data-prop={name} className={className} transform={transform}>
      {children}
    </g>
  );
}

/** A leafy plant in a pot; `kind` picks the leaf. */
export function Plant({ x, y, s = 1, pot, leaf, kind = "round", seed = 1 }: { x: number; y: number; s?: number; pot: string; leaf: string; kind?: "round" | "trail" | "monstera" | "snake"; seed?: number }) {
  const leaves = kind === "snake" ? 7 : kind === "monstera" ? 7 : 9;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {kind === "trail" &&
        [0, 1, 2, 3].map((i) => (
          <path key={`t${i}`} d={`M ${-10 + i * 7} -6 q ${-6 + i * 4} ${30 + i * 8} ${2 - i} ${60 + rnd(seed + i) * 30}`} fill="none" stroke={darken(leaf, 0.2)} strokeWidth={1.6} />
        ))}
      {kind === "trail" &&
        [0, 1, 2, 3, 4, 5, 6, 7].map((i) => <ellipse key={`l${i}`} cx={-12 + (i % 4) * 8 + (i > 3 ? 3 : 0)} cy={10 + i * 8} rx={4} ry={2.6} fill={i % 2 ? leaf : lighten(leaf, 0.15)} transform={`rotate(${i * 40} ${-12 + (i % 4) * 8} ${10 + i * 8})`} />)}
      {Array.from({ length: leaves }, (_, i) => {
        const a = -150 + (i / (leaves - 1)) * 120 + (rnd(seed * 7 + i) - 0.5) * 14;
        const len = (kind === "snake" ? 46 : kind === "monstera" ? 34 : 22) * (0.75 + rnd(seed + i) * 0.4);
        const rad = (a * Math.PI) / 180;
        const ex = Math.cos(rad) * len;
        const ey = Math.sin(rad) * len - 6;
        const c = i % 3 === 0 ? lighten(leaf, 0.18) : i % 3 === 1 ? leaf : darken(leaf, 0.15);
        if (kind === "snake") return <path key={i} d={`M ${ex * 0.1} -6 Q ${ex * 0.5 - 5} ${ey * 0.6} ${ex} ${ey} Q ${ex * 0.5 + 5} ${ey * 0.6} ${ex * 0.1 + 6} -6 Z`} fill={c} />;
        const w = kind === "monstera" ? 14 : 7;
        return (
          <g key={i}>
            <path d={`M 0 -6 L ${ex} ${ey}`} stroke={darken(leaf, 0.3)} strokeWidth={1.2} />
            <ellipse cx={ex} cy={ey} rx={w} ry={w * 0.6} fill={c} transform={`rotate(${a} ${ex} ${ey})`} />
            {kind === "monstera" && <path d={`M ${ex - 6} ${ey} l 5 2 M ${ex + 1} ${ey - 3} l 4 3`} stroke={darken(leaf, 0.2)} strokeWidth={1.4} />}
          </g>
        );
      })}
      <path d="M -14 -8 L 14 -8 L 11 16 Q 0 19 -11 16 Z" fill={pot} />
      <path d="M -14 -8 L 14 -8 L 13.5 -3 L -13.5 -3 Z" fill={darken(pot, 0.2)} />
      <path d="M -11 -2 L -9 15" stroke={lighten(pot, 0.35)} strokeWidth={2} opacity={0.6} />
    </g>
  );
}

/** A row of book spines standing on a shelf at `y`, starting at `x`, `w` wide. */
export function Books({ x, y, w, seed, colors, lean = true }: { x: number; y: number; w: number; seed: number; colors: string[]; lean?: boolean }) {
  const out: ReactNode[] = [];
  let at = x;
  let i = 0;
  while (at < x + w - 6) {
    const bw = 5 + Math.floor(rnd(seed + i) * 6);
    const bh = 20 + Math.floor(rnd(seed * 3 + i) * 14);
    const c = colors[Math.floor(rnd(seed * 5 + i) * colors.length)]!;
    const tilt = lean && i === 3 ? 12 : 0;
    out.push(
      <g key={i} transform={tilt ? `rotate(${tilt} ${at} ${y})` : undefined}>
        <rect x={at} y={y - bh} width={bw} height={bh} fill={c} />
        <rect x={at} y={y - bh} width={1.4} height={bh} fill={lighten(c, 0.3)} opacity={0.7} />
        <rect x={at} y={y - bh + 4} width={bw} height={1.2} fill={lighten(c, 0.45)} opacity={0.6} />
      </g>,
    );
    at += bw + (tilt ? 4 : 0.6);
    i++;
  }
  return <>{out}</>;
}

/** A glass jar with a lid, a label and something inside. */
export function Jar({ x, y, w = 22, h = 30, fill, lid }: { x: number; y: number; w?: number; h?: number; fill: string; lid: string }) {
  return (
    <g>
      <rect x={x} y={y - h} width={w} height={h} rx={4} fill={fill} opacity={0.92} />
      <rect x={x} y={y - h * 0.62} width={w} height={h * 0.62} rx={4} fill={darken(fill, 0.18)} opacity={0.6} />
      <rect x={x + 3} y={y - h + 4} width={3} height={h - 8} rx={1.5} fill="#ffffff" opacity={0.35} />
      <rect x={x - 1} y={y - h - 5} width={w + 2} height={6} rx={2} fill={lid} />
      <rect x={x + w * 0.2} y={y - h * 0.55} width={w * 0.6} height={h * 0.28} fill="#f3ead8" opacity={0.85} />
    </g>
  );
}

/** A picture frame with a mat and whatever `children` draws inside (x, y is the top left). */
export function Frame({ x, y, w, h, frame, mat = "#efe6d4", children }: { x: number; y: number; w: number; h: number; frame: string; mat?: string; children?: ReactNode }) {
  return (
    <g>
      <rect x={x + 3} y={y + 5} width={w} height={h} rx={2} fill="#000000" opacity={0.22} />
      <rect x={x} y={y} width={w} height={h} rx={2} fill={frame} />
      <rect x={x + 1} y={y + 1} width={w - 2} height={2} fill={lighten(frame, 0.35)} opacity={0.6} />
      <rect x={x + 4} y={y + 4} width={w - 8} height={h - 8} fill={mat} />
      {children}
    </g>
  );
}

/** A mug seen from the side, with optional steam. */
export function Mug({ x, y, c = "#f3efe8", s = 1, steam = false, delay = 0, className = "" }: { x: number; y: number; c?: string; s?: number; steam?: boolean; delay?: number; className?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <Shadow cx={0} cy={0} rx={14} ry={3} o={0.5} />
      <path d="M -9 -18 L 9 -18 L 8 -2 Q 0 1 -8 -2 Z" fill={c} />
      <path d="M 2 -18 L 9 -18 L 8 -2 Q 5 0 2 0 Z" fill={darken(c, 0.14)} />
      <path d="M 9 -14 q 7 1 0 9" fill="none" stroke={c} strokeWidth={2.4} />
      <ellipse cx={0} cy={-18} rx={9} ry={2.4} fill="#4a2e1c" />
      {steam && (
        <path
          className={`particle steam ${className}`}
          d="M 0 -24 q -5 -9 0 -18 q 5 -9 0 -18"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.6}
          strokeLinecap="round"
          opacity={0.3}
          style={{ animationDelay: `${delay}s` }}
        />
      )}
    </g>
  );
}

export type Hair = "short" | "long" | "bun" | "cap" | "hijab" | "bob";

export interface FigureProps {
  x: number;
  y: number;
  skin: string;
  hair: string;
  hairStyle?: Hair;
  shirt: string;
  /** 1 faces left, -1 faces right (the drawing is mirrored). */
  facing: 1 | -1;
  hold?: "phone" | "cup" | "book" | null;
  headphones?: boolean;
  glasses?: boolean;
  className: string;
  delay: number;
  t: (c: string, k?: number) => string;
}

function HairShape({ style, hair, t }: { style: Hair; hair: string; t: FigureProps["t"] }) {
  const h = t(hair);
  const hi = t(lighten(hair, 0.22));
  switch (style) {
    case "long":
      return (
        <g>
          <path d="M -23 -40 Q -24 -66 0 -64 Q 25 -62 22 -38 L 24 -4 Q 14 2 8 -8 L 8 -40 Q -6 -48 -23 -40 Z" fill={h} />
          <path d="M -14 -58 Q 0 -64 14 -56" fill="none" stroke={hi} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case "bun":
      return (
        <g>
          <circle cx={10} cy={-64} r={10} fill={h} />
          <path d="M -22 -40 Q -20 -64 2 -62 Q 24 -60 22 -36 Q 12 -50 -6 -48 Q -16 -46 -22 -40 Z" fill={h} />
          <path d="M -12 -57 Q 0 -62 12 -56" fill="none" stroke={hi} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
    case "cap":
      return (
        <g>
          <path d="M -22 -44 Q -18 -66 4 -64 Q 24 -62 22 -44 Z" fill={h} />
          <path d="M -22 -44 L -38 -42 Q -32 -48 -20 -48 Z" fill={darken(h, 0.2)} />
          <path d="M -10 -60 Q 2 -64 14 -58" fill="none" stroke={hi} strokeWidth={2.5} />
        </g>
      );
    case "hijab":
      return (
        <g>
          <path d="M -25 -36 Q -26 -66 0 -65 Q 27 -64 25 -34 L 28 -2 Q 0 8 -26 -2 Z" fill={h} />
          <path d="M -17 -36 Q -16 -54 0 -54 Q 15 -53 14 -34 Q 12 -22 -2 -18 Q -16 -22 -17 -36 Z" fill="none" />
          <path d="M -12 -60 Q 2 -64 16 -56" fill="none" stroke={hi} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    case "bob":
      return (
        <g>
          <path d="M -24 -38 Q -24 -66 0 -64 Q 25 -62 23 -36 L 22 -22 Q 14 -18 10 -26 L 10 -44 Q -6 -48 -16 -40 L -18 -22 Q -24 -24 -24 -38 Z" fill={h} />
          <path d="M -14 -58 Q 0 -63 14 -56" fill="none" stroke={hi} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M -22 -40 Q -20 -64 2 -62 Q 24 -60 22 -38 Q 12 -52 -6 -48 Q -16 -46 -22 -40 Z" fill={h} />
          <path d="M -10 -58 Q 2 -62 14 -55" fill="none" stroke={hi} strokeWidth={2.5} strokeLinecap="round" />
        </g>
      );
  }
}

/** A seated person in profile: soft shading, a rim of lamp light, and slow idle loops on the head and arm. */
export function Figure({ x, y, skin, hair, hairStyle = "short", shirt, facing, hold, headphones, glasses, className, delay, t }: FigureProps) {
  const sk = t(skin);
  const sh = t(shirt);
  const hijab = hairStyle === "hijab";
  return (
    <g className={`patron ${className}`} transform={`translate(${x} ${y}) scale(${facing} 1)`}>
      <path d="M -26 4 Q -28 -8 -14 -8 L 14 -8 Q 28 -8 26 6 L 24 68 L -24 68 Z" fill={sh} />
      <path d="M 6 -8 L 14 -8 Q 28 -8 26 6 L 24 68 L 4 68 Q 10 30 6 -8 Z" fill={darken(sh, 0.22)} opacity={0.75} />
      <path d="M -24 4 Q -25 -6 -14 -7" fill="none" stroke={lighten(sh, 0.35)} strokeWidth={2} opacity={0.7} />
      <g className="patron-head" style={{ animationDelay: `${delay}s` }}>
        <rect x={-7} y={-18} width={14} height={16} fill={darken(sk, 0.12)} />
        {hijab && <HairShape style="hijab" hair={hair} t={t} />}
        <circle cx={0} cy={-38} r={21} fill={sk} />
        <path d="M 4 -56 Q 22 -50 20 -30 Q 16 -20 6 -18 Q 16 -34 4 -56 Z" fill={darken(sk, 0.14)} opacity={0.6} />
        {!hijab && <HairShape style={hairStyle} hair={hair} t={t} />}
        {hijab && <path d="M -22 -40 Q -22 -62 0 -62 Q 23 -61 21 -38 Q 14 -54 -2 -54 Q -16 -54 -22 -40 Z" fill={t(hair)} />}
        <circle cx={-12} cy={-37} r={2.2} fill="#1f1a17" />
        <ellipse cx={-12} cy={-29} rx={3.4} ry={2} fill="#e0806a" opacity={0.35} />
        <path d="M -21 -30 q -3 2 -1 4" fill="none" stroke={darken(sk, 0.3)} strokeWidth={1.4} />
        {!hijab && <ellipse cx={4} cy={-36} rx={4} ry={5} fill={darken(sk, 0.1)} />}
        {glasses && <path d="M -20 -40 h 12 v 7 h -12 z M -8 -37 h 8" fill="none" stroke="#1f1a17" strokeWidth={1.5} />}
        {headphones && (
          <g>
            <path d="M -18 -50 Q 0 -72 18 -50" fill="none" stroke="#2a2d33" strokeWidth={4} />
            <rect x={-2} y={-46} width={12} height={16} rx={5} fill="#2a2d33" />
            <rect x={0} y={-43} width={4} height={10} rx={2} fill="#4a4f58" />
          </g>
        )}
      </g>
      <g className="patron-arm" style={{ animationDelay: `${delay + 1.3}s` }}>
        <path d="M -12 10 Q -36 30 -52 20" fill="none" stroke={darken(sh, 0.08)} strokeWidth={13} strokeLinecap="round" />
        <circle cx={-54} cy={19} r={6.5} fill={sk} />
        {hold === "phone" && (
          <g>
            <rect x={-68} y={4} width={13} height={23} rx={3} fill="#1f2328" />
            <rect x={-66.5} y={6} width={10} height={18} rx={1.5} fill="#9fd3ff" opacity={0.85} />
          </g>
        )}
        {hold === "cup" && (
          <g>
            <path d="M -66 4 L -52 4 L -53 20 Q -59 22 -65 20 Z" fill={t("#f3efe8")} />
            <path d="M -66 10 L -52 10" stroke={t("#b0703f")} strokeWidth={3} />
          </g>
        )}
        {hold === "book" && (
          <g>
            <path d="M -74 2 L -58 8 L -58 30 L -74 24 Z" fill={t("#c2463a")} />
            <path d="M -58 8 L -44 2 L -44 24 L -58 30 Z" fill={t("#f6f1e6")} />
          </g>
        )}
      </g>
      <rect x={-22} y={60} width={40} height={14} rx={6} fill={t("#2f3440")} />
    </g>
  );
}

/** Someone seen from behind, at the window bar; the far side of the room is lit against them. */
export function Back({ x, y, skin, hair, hairStyle = "short", shirt, hood, headphones, className, delay, t }: Omit<FigureProps, "facing" | "hold" | "glasses"> & { hood?: boolean }) {
  const sh = t(shirt);
  return (
    <g className={`patron ${className}`} transform={`translate(${x} ${y})`}>
      <path d="M -34 70 Q -36 8 -20 -2 Q 0 -10 20 -2 Q 36 8 34 70 Z" fill={sh} />
      <path d="M 6 -6 Q 36 8 34 70 L 12 70 Q 16 20 6 -6 Z" fill={darken(sh, 0.2)} opacity={0.7} />
      <path d="M -30 60 Q -32 12 -18 2" fill="none" stroke={lighten(sh, 0.3)} strokeWidth={2} opacity={0.6} />
      {hood && <path d="M -22 2 Q -26 -18 0 -20 Q 26 -18 22 2 Q 0 12 -22 2 Z" fill={darken(sh, 0.12)} />}
      <g className="patron-head" style={{ animationDelay: `${delay}s` }}>
        <rect x={-8} y={-18} width={16} height={16} fill={t(darken(skin, 0.15))} />
        <circle cx={0} cy={-38} r={21} fill={t(skin)} />
        <ellipse cx={-21} cy={-36} rx={3.5} ry={5.5} fill={t(darken(skin, 0.1))} />
        <ellipse cx={21} cy={-36} rx={3.5} ry={5.5} fill={t(darken(skin, 0.1))} />
        {hairStyle === "hijab" ? (
          <path d="M -25 -34 Q -26 -64 0 -64 Q 26 -64 25 -34 L 30 0 Q 0 10 -30 0 Z" fill={t(hair)} />
        ) : hairStyle === "long" ? (
          <path d="M -23 -36 Q -24 -64 0 -63 Q 24 -64 23 -36 L 22 4 Q 0 10 -22 4 Z" fill={t(hair)} />
        ) : hairStyle === "bun" ? (
          <g>
            <circle cx={0} cy={-62} r={10} fill={t(hair)} />
            <path d="M -22 -34 Q -24 -62 0 -62 Q 24 -62 22 -34 Q 12 -24 0 -24 Q -12 -24 -22 -34 Z" fill={t(hair)} />
          </g>
        ) : (
          <path d="M -22 -34 Q -24 -62 0 -62 Q 24 -62 22 -34 Q 12 -26 0 -26 Q -12 -26 -22 -34 Z" fill={t(hair)} />
        )}
        <path d="M -12 -56 Q 0 -62 12 -56" fill="none" stroke={t(lighten(hair, 0.25))} strokeWidth={3} strokeLinecap="round" />
        {headphones && (
          <g>
            <path d="M -22 -40 Q 0 -74 22 -40" fill="none" stroke="#2a2d33" strokeWidth={4.5} />
            <rect x={-28} y={-46} width={10} height={18} rx={5} fill="#2a2d33" />
            <rect x={18} y={-46} width={10} height={18} rx={5} fill="#2a2d33" />
          </g>
        )}
      </g>
    </g>
  );
}

/** A café chair seen from the front or side: bentwood back and legs. */
export function Chair({ x, y, c, s = 1, back = true }: { x: number; y: number; c: string; s?: number; back?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {back && <path d="M -16 -2 L -16 -46 Q 0 -56 16 -46 L 16 -2" fill="none" stroke={c} strokeWidth={4} />}
      {back && <path d="M -12 -30 Q 0 -36 12 -30" fill="none" stroke={c} strokeWidth={2.5} />}
      <rect x={-20} y={-4} width={40} height={6} rx={3} fill={lighten(c, 0.1)} />
      <path d="M -16 2 L -19 44 M 16 2 L 19 44 M -8 2 L -7 40 M 8 2 L 7 40" stroke={darken(c, 0.15)} strokeWidth={3} />
    </g>
  );
}
