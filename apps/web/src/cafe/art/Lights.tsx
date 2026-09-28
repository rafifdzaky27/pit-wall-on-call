import type { SceneModel } from "@pitwall/world";
import { memo } from "react";
import { darken, Glow, lighten, Prop, toner } from "./kit";

const LAMPS = [980, 1180, 1380];
const DROP = 236;

type Tone = ReturnType<typeof toner>;

function Shade({ x, model, t }: { x: number; model: SceneModel; t: Tone }) {
  const { lamp } = model.palette;
  const d = model.sign.decor;
  switch (d.style) {
    case "kissaten":
      return (
        <g>
          <path d={`M ${x - 30} ${DROP + 34} Q ${x - 30} ${DROP} ${x} ${DROP} Q ${x + 30} ${DROP} ${x + 30} ${DROP + 34} Z`} fill={t("#c9782a", 0.4)} />
          {[-20, -7, 7, 20].map((o, i) => (
            <path key={o} d={`M ${x + o} ${DROP + 4} L ${x + o * 1.4} ${DROP + 33}`} stroke={t(i % 2 ? "#9e2b31" : "#2f6b3f", 0.4)} strokeWidth={5} opacity={0.6} />
          ))}
          <path d={`M ${x - 30} ${DROP + 34} Q ${x - 30} ${DROP} ${x} ${DROP}`} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.25} />
          <ellipse cx={x} cy={DROP + 34} rx={30} ry={5} fill={lamp} />
        </g>
      );
    case "kopi":
      return (
        <g>
          <path d={`M ${x - 10} ${DROP + 2} L ${x + 10} ${DROP + 2} L ${x + 8} ${DROP + 10} L ${x - 8} ${DROP + 10} Z`} fill="#1f1c1a" />
          <path d={`M ${x - 12} ${DROP + 10} Q ${x - 16} ${DROP + 34} ${x} ${DROP + 38} Q ${x + 16} ${DROP + 34} ${x + 12} ${DROP + 10}`} fill="none" stroke="#1f1c1a" strokeWidth={1.6} />
          <path d={`M ${x} ${DROP + 10} L ${x} ${DROP + 38} M ${x - 13} ${DROP + 24} L ${x + 13} ${DROP + 24}`} stroke="#1f1c1a" strokeWidth={1.2} />
          <ellipse cx={x} cy={DROP + 24} rx={8} ry={11} fill={lighten(lamp, 0.3)} />
          <path d={`M ${x - 3} ${DROP + 18} q 3 6 0 12 M ${x + 3} ${DROP + 18} q -3 6 0 12`} fill="none" stroke="#e08a2a" strokeWidth={1} />
        </g>
      );
    case "joglo":
      return (
        <g>
          <ellipse cx={x} cy={DROP + 20} rx={24} ry={22} fill={t("#c9a26b", 0.4)} />
          {[-14, -5, 5, 14].map((o) => (
            <path key={o} d={`M ${x + o} ${DROP} Q ${x + o * 1.7} ${DROP + 20} ${x + o} ${DROP + 40}`} fill="none" stroke={t("#8a5a3b", 0.4)} strokeWidth={1.4} />
          ))}
          {[8, 20, 32].map((o) => (
            <path key={o} d={`M ${x - 22} ${DROP + o} Q ${x} ${DROP + o + 4} ${x + 22} ${DROP + o}`} fill="none" stroke={t("#8a5a3b", 0.4)} strokeWidth={1.2} />
          ))}
          <ellipse cx={x} cy={DROP + 22} rx={16} ry={16} fill={lamp} opacity={0.55} />
        </g>
      );
    default:
      return (
        <g>
          <path d={`M ${x - 34} ${DROP + 34} L ${x - 14} ${DROP} L ${x + 14} ${DROP} L ${x + 34} ${DROP + 34} Z`} fill={t(darken(d.accent, 0.1), 0.4)} />
          <path d={`M ${x - 34} ${DROP + 34} L ${x - 14} ${DROP} L ${x - 8} ${DROP} L ${x - 24} ${DROP + 34} Z`} fill="#ffffff" opacity={0.18} />
          <ellipse cx={x} cy={DROP + 35} rx={20} ry={5} fill={lamp} />
        </g>
      );
  }
}

/**
 * Light, laid over the finished room (M2.5 spec §12): the pendant lamps and their pools, daylight
 * from the window, the laptop's glow on the table, and a vignette. Only glows, never filters.
 */
export const Lights = memo(function Lights({ model }: { model: SceneModel }) {
  const t = toner(model);
  const { lampGlow, daylight } = model.palette;
  const dark = model.time === "dusk" || model.time === "night";
  return (
    <g className="lights" data-layer="light">
      {daylight > 0 && (
        <Prop name="daylight">
          <path d="M 110 520 L 760 520 L 1200 940 L 380 940 Z" fill="url(#cf-daylight)" />
        </Prop>
      )}
      <Prop name="pendant-lamps">
        {LAMPS.map((x, i) => (
          <g key={x}>
            <path d={`M ${x - 110} ${DROP + 36} L ${x + 110} ${DROP + 36} L ${x + 190} 410 L ${x - 190} 410 Z`} fill="url(#cf-glow-soft)" opacity={lampGlow * 0.6} />
            <circle className={`lamp-glow${i === 1 ? " flicker" : ""}`} cx={x} cy={DROP + 34} r={150} fill="url(#cf-glow)" opacity={lampGlow} style={{ animationDelay: `${i * 1.7}s` }} />
            <line x1={x} y1={40} x2={x} y2={DROP + 2} stroke="#2a2320" strokeWidth={1.5} opacity={0.6} />
            <Shade x={x} model={model} t={t} />
            <Glow cx={x} cy={404} r={100} ry={14} o={lampGlow * 0.8} />
          </g>
        ))}
      </Prop>
      <Prop name="table-lamp-pool">
        <Glow cx={620} cy={770} r={520} ry={130} fill="url(#cf-glow-soft)" o={0.35 + lampGlow * 0.4} />
        <Glow cx={1200} cy={600} r={220} ry={60} fill="url(#cf-glow-soft)" o={lampGlow * 0.6} />
      </Prop>
      <Prop name="screen-glow">
        <Glow cx={800} cy={770} r={300} ry={70} fill="url(#cf-screen-glow)" o={dark ? 0.9 : 0.4} className="screen-glow" />
      </Prop>
      <rect x={-40} y={-40} width={1680} height={980} fill="url(#cf-vignette)" pointerEvents="none" />
    </g>
  );
});
