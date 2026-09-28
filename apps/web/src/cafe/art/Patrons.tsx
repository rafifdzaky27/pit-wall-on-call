import type { SceneModel } from "@pitwall/world";
import { memo } from "react";
import { Back, Chair, darken, Figure, lighten, MONO, Mug, Plant, Prop, Shadow, toner } from "./kit";

/** The next table, where the overheard clue sits (`table.neighbours`). */
export const NEIGHBOURS = { x: 1040, y: 520, w: 320, h: 190 } as const;
/** Easter eggs in the room (M2.5 spec §12): the sleeping cat, and the coder at the window. */
export const CAT = { x: 380, y: 480, w: 100, h: 44 } as const;
export const FORCE_PUSH = { x: 206, y: 424, w: 150, h: 130 } as const;
const TABLE_Y = 606;
const BAR_Y = 546;

type Tone = ReturnType<typeof toner>;

function Floor({ model, t }: { model: SceneModel; t: Tone }) {
  const d = model.sign.decor;
  return (
    <>
      <Prop name="floor">
        <rect x={-40} y={620} width={1680} height={330} fill="url(#cf-floor-tex)" />
        <rect x={-40} y={620} width={1680} height={330} fill="url(#cf-floor)" opacity={0.35} />
        <rect x={-40} y={620} width={1680} height={40} fill="#000000" opacity={0.25} />
      </Prop>
      <Prop name="rug">
        <path d="M 930 646 L 1520 646 L 1600 740 L 860 740 Z" fill={t(d.accent)} />
        <path d="M 944 652 L 1506 652 L 1580 734 L 878 734 Z" fill="none" stroke={t(lighten(d.accent, 0.4))} strokeWidth={4} strokeDasharray="10 6" />
        <path d="M 964 662 L 1486 662 L 1552 726 L 900 726 Z" fill={t(darken(d.accent, 0.2))} />
        <path d="M 964 662 L 1486 662 L 1552 726 L 900 726 Z" fill="url(#cf-batik)" opacity={d.style === "joglo" ? 0.8 : 0.18} />
      </Prop>
    </>
  );
}

/** The bar along the window, with its two regulars and the cat asleep on the sill. */
function WindowBar({ model, t, empty }: { model: SceneModel; t: Tone; empty: boolean }) {
  const [s0, s1, s2] = model.palette.skin as [string, string, string];
  return (
    <>
      <Prop name="window-bar">
        <rect x={86} y={BAR_Y} width={530} height={12} rx={3} fill="url(#cf-wood)" />
        <rect x={86} y={BAR_Y} width={530} height={2.5} fill="#ffffff" opacity={0.2} />
        <rect x={86} y={BAR_Y + 12} width={530} height={6} fill="#000000" opacity={0.3} />
        {[120, 360, 590].map((x) => (
          <path key={x} d={`M ${x} ${BAR_Y + 12} l 0 22 l -16 0`} fill="none" stroke={t("#2a2d33")} strokeWidth={4} />
        ))}
      </Prop>
      <Prop name="bar-stools">
        {[250, 520].map((x) => (
          <g key={x}>
            <ellipse cx={x} cy={598} rx={24} ry={6} fill={t("#2a2d33")} />
            <path d={`M ${x - 14} 600 L ${x - 20} 690 M ${x + 14} 600 L ${x + 20} 690 M ${x - 17} 650 L ${x + 17} 650`} stroke={t("#2a2d33")} strokeWidth={3.5} />
            <Shadow cx={x} cy={692} rx={34} ry={6} o={0.4} />
          </g>
        ))}
      </Prop>
      <Prop name="patron-force-push">
        <Back x={250} y={520} skin={s1} hair="#1f1a17" hairStyle="short" shirt="#3a4a5a" hood headphones className="at-bar coder" delay={0.6} t={t} />
        {/* Their laptop, turned so the screen shows past a shoulder. */}
        <path d="M 282 544 L 352 544 L 358 548 L 276 548 Z" fill={t("#9aa1aa")} />
        <rect x={284} y={502} width={66} height={43} rx={3} fill="#1a1d22" />
        <rect x={287} y={505} width={60} height={37} fill="#0e1a14" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={290} y={509 + i * 6} width={20 + ((i * 17) % 26)} height={2.4} fill={i === 1 ? "#e0a43a" : "#6bdc7b"} opacity={0.8} />
        ))}
        <text x={290} y={534} fontFamily={MONO} fontSize={5.6} fill="#e8f5e8">
          $ git push --force
        </text>
        <rect className="cursor-blink" x={290} y={537} width={3.5} height={4} fill="#e8f5e8" />
        <circle cx={318} cy={522} r={48} fill="url(#cf-screen-glow)" opacity={0.6} />
      </Prop>
      {!empty && (
        <Prop name="patron-window">
          <Back x={520} y={522} skin={s2} hair="#5a3a22" hairStyle="bun" shirt="#b86a4a" className="at-bar" delay={2.2} t={t} />
          <Mug x={566} y={BAR_Y} c={t("#e8e0cc")} s={0.9} steam delay={1.2} />
        </Prop>
      )}
      <Prop name="backpack">
        <path d="M 160 692 Q 156 640 186 636 Q 214 640 210 692 Z" fill={t("#6b8f71")} />
        <path d="M 168 660 L 202 660 L 202 684 L 168 684 Z" fill={t(darken("#6b8f71", 0.15))} />
        <path d="M 176 640 Q 186 624 196 640" fill="none" stroke={t("#3a4a3a")} strokeWidth={3} />
      </Prop>
      <Cat t={t} skin={s0} />
    </>
  );
}

/** The café cat, asleep on the sill. Its body rises and falls; a click makes it purr (see Hotspots). */
function Cat({ t }: { t: Tone; skin: string }) {
  const fur = t("#e39a4a");
  const dark = t("#b8642a");
  const { x, y } = CAT;
  return (
    <Prop name="cafe-cat" className="cafe-cat">
      <Shadow cx={x + 50} cy={y + 40} rx={48} ry={5} o={0.45} />
      <g className="cat-body">
        <ellipse cx={x + 46} cy={y + 26} rx={40} ry={14} fill={fur} />
        <path d={`M ${x + 20} ${y + 16} q 6 -4 10 4 M ${x + 36} ${y + 13} q 6 -4 10 4 M ${x + 52} ${y + 13} q 6 -4 10 4`} fill="none" stroke={dark} strokeWidth={3} strokeLinecap="round" />
        <ellipse cx={x + 46} cy={y + 34} rx={34} ry={5} fill={t("#f6e6cc")} opacity={0.8} />
      </g>
      <g className="cat-head">
        <circle cx={x + 82} cy={y + 26} r={12} fill={fur} />
        <path d={`M ${x + 73} ${y + 18} L ${x + 72} ${y + 6} L ${x + 81} ${y + 14} Z M ${x + 86} ${y + 14} L ${x + 94} ${y + 6} L ${x + 93} ${y + 19} Z`} fill={fur} />
        <path d={`M ${x + 75} ${y + 16} L ${x + 74} ${y + 10} L ${x + 79} ${y + 14} Z`} fill={t("#e8a0a0")} />
        <path d={`M ${x + 76} ${y + 27} q 3 2 6 0 M ${x + 85} ${y + 27} q 3 2 6 0`} fill="none" stroke="#3a2414" strokeWidth={1.4} strokeLinecap="round" />
        <circle cx={x + 84} cy={y + 31} r={1.2} fill="#c86a6a" />
      </g>
      <path className="cat-tail" d={`M ${x + 8} ${y + 30} Q ${x - 4} ${y + 40} ${x + 20} ${y + 40} Q ${x + 44} ${y + 42} ${x + 66} ${y + 38}`} fill="none" stroke={fur} strokeWidth={7} strokeLinecap="round" />
      <g className="cat-zzz" fill={t("#f3efe6")} fontFamily="IBM Plex Sans, sans-serif" fontWeight={700}>
        <text className="particle zzz" x={x + 90} y={y + 6} fontSize={9}>
          z
        </text>
        <text className="particle zzz" x={x + 98} y={y - 4} fontSize={7} style={{ animationDelay: "-1.5s" }}>
          z
        </text>
      </g>
    </Prop>
  );
}

function NextTable({ model, t, empty }: { model: SceneModel; t: Tone; empty: boolean }) {
  const { palette, patrons } = model;
  const [s0, s1, s2] = palette.skin as [string, string, string];
  const atTable = empty ? 0 : patrons === 2 ? 1 : 2;
  const covered = model.sign.decor.style === "kopi" || model.sign.decor.style === "joglo";
  return (
    <>
      <Prop name="next-table-chairs">
        <Chair x={1086} y={TABLE_Y - 2} c={t(palette.woodDark)} />
        <Chair x={1314} y={TABLE_Y - 2} c={t(palette.woodDark)} />
      </Prop>
      {patrons > 0 && !empty && (
        <Prop name="patron-counter">
          <g className="stool">
            <rect x={940} y={528} width={44} height={9} rx={4} fill={t(palette.woodDark)} />
            <rect x={958} y={537} width={8} height={83} fill={t("#3d4146")} />
            <rect x={944} y={586} width={36} height={4} rx={2} fill={t("#3d4146")} />
          </g>
          <Figure className="at-counter" x={960} y={452} skin={s2} hair="#3a2a1f" hairStyle="cap" shirt="#6b8f71" facing={-1} delay={2.4} t={t} />
        </Prop>
      )}
      <Prop name="next-table-patrons">
        {atTable >= 1 && <Figure className="at-table" x={1100} y={546} skin={s0} hair="#1f1a17" hairStyle={covered ? "hijab" : "long"} shirt="#c2463a" facing={-1} hold="phone" delay={0} t={t} />}
        {atTable >= 2 && <Figure className="at-table" x={1300} y={546} skin={s1} hair="#5a3a22" hairStyle="short" shirt="#3b6ea5" facing={1} glasses delay={1.1} t={t} />}
      </Prop>
      <Prop name="next-table">
        <Shadow cx={1200} cy={TABLE_Y + 104} rx={120} ry={10} />
        <rect x={1040} y={TABLE_Y} width={320} height={14} rx={4} fill="url(#cf-wood)" />
        <rect x={1040} y={TABLE_Y} width={320} height={3} rx={1.5} fill="#ffffff" opacity={0.2} />
        <rect x={1192} y={TABLE_Y + 14} width={16} height={90} fill={t(palette.woodDark)} />
        <rect x={1150} y={TABLE_Y + 100} width={100} height={8} rx={4} fill={t(palette.woodDark)} />
      </Prop>
      <Prop name="next-table-cups">
        {atTable >= 1 && <Mug x={1150} y={TABLE_Y} c={t("#f3efe8")} steam delay={0.4} />}
        {atTable >= 2 && <Mug x={1250} y={TABLE_Y} c={t("#e8d8b8")} steam delay={1.6} />}
        <path d={`M 1180 ${TABLE_Y} l 30 0 l -4 -3 l -22 0 z`} fill={t("#f3efe8")} />
        <path d={`M 1186 ${TABLE_Y - 3} l 8 -9 l 10 9 z`} fill={t("#d89a4a")} />
      </Prop>
      <Prop name="tote-bag">
        <path d="M 1216 700 L 1262 700 L 1258 660 L 1220 660 Z" fill={t("#e6d3a3")} />
        <path d="M 1226 660 Q 1239 636 1252 660" fill="none" stroke={t("#c9a26b")} strokeWidth={3} />
        <rect x={1228} y={672} width={22} height={12} fill={t(model.sign.decor.accent)} opacity={0.8} />
      </Prop>
    </>
  );
}

/** Two more tables at the edges of a wide screen. */
function EdgeTables({ model, t, empty }: { model: SceneModel; t: Tone; empty: boolean }) {
  const [s0, s1, s2] = model.palette.skin as [string, string, string];
  const covered = model.sign.decor.style === "kopi" || model.sign.decor.style === "joglo";
  return (
    <>
      <Prop name="far-table">
        <Chair x={1456} y={606} c={t(model.palette.woodDark)} />
        {!empty && <Figure className="at-far-table" x={1460} y={548} skin={s2} hair="#2a2320" hairStyle="bob" shirt="#e0a43a" facing={-1} hold="book" delay={0.7} t={t} />}
        {!empty && <Figure className="at-far-table" x={1590} y={548} skin={s0} hair="#1f1a17" hairStyle="short" shirt="#4a5a6a" facing={1} hold="cup" headphones delay={2.9} t={t} />}
        <Shadow cx={1525} cy={712} rx={80} ry={8} />
        <ellipse cx={1525} cy={608} rx={70} ry={10} fill="url(#cf-wood)" />
        <rect x={1519} y={612} width={12} height={96} fill={t(model.palette.woodDark)} />
        <Mug x={1500} y={606} c={t("#f3efe8")} s={0.8} />
      </Prop>
      <Prop name="left-table">
        {!empty && <Figure className="at-left-table" x={40} y={554} skin={s1} hair={covered ? "#6b3a5a" : "#3a2a1f"} hairStyle={covered ? "hijab" : "bun"} shirt="#6b8f71" facing={-1} hold="cup" delay={1.7} t={t} />}
        <Shadow cx={130} cy={714} rx={70} ry={8} />
        <ellipse cx={130} cy={612} rx={60} ry={9} fill="url(#cf-wood)" />
        <rect x={124} y={616} width={12} height={96} fill={t(model.palette.woodDark)} />
        <Plant x={150} y={600} s={0.6} pot={t("#e6d3a3")} leaf={t("#5a9a6a")} seed={41} />
      </Prop>
      <Prop name="umbrella-stand">
        <rect x={-30} y={640} width={34} height={60} rx={4} fill={t("#3a3f47")} />
        {["#c2463a", "#2f4858", "#e0a43a"].map((c, i) => (
          <line key={i} x1={-22 + i * 9} y1={642} x2={-26 + i * 12} y2={590 + i * 6} stroke={t(c)} strokeWidth={5} strokeLinecap="round" />
        ))}
      </Prop>
    </>
  );
}

/** The room behind the player's table: floor, rug, tables and the people at them (the room layer's back half). */
export const Patrons = memo(function Patrons({ model, empty }: { model: SceneModel; empty: boolean }) {
  const t = toner(model);
  return (
    <g className="patrons layer-mid">
      <Floor model={model} t={t} />
      <WindowBar model={model} t={t} empty={empty} />
      <EdgeTables model={model} t={t} empty={empty} />
      <NextTable model={model} t={t} empty={empty} />
    </g>
  );
});
