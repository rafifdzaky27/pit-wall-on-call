import type { SceneModel } from "@pitwall/world";

/** The next table, where the overheard clue sits (`table.neighbours`). */
export const NEIGHBOURS = { x: 1040, y: 520, w: 320, h: 190 } as const;
const TABLE_Y = 606;

interface FigureProps {
  x: number;
  y: number;
  skin: string;
  hair: string;
  shirt: string;
  /** 1 faces left, -1 faces right (the drawing is mirrored). */
  facing: 1 | -1;
  phone?: boolean;
  className: string;
  delay: number;
}

/** A seated person, drawn from simple shapes; the head and arm move on slow idle loops. */
function Figure({ x, y, skin, hair, shirt, facing, phone, className, delay }: FigureProps) {
  return (
    <g className={`patron ${className}`} transform={`translate(${x} ${y}) scale(${facing} 1)`}>
      <rect x={-26} y={-6} width={52} height={74} rx={20} fill={shirt} />
      <g className="patron-head" style={{ animationDelay: `${delay}s` }}>
        <rect x={-7} y={-18} width={14} height={16} fill={skin} />
        <circle cx={0} cy={-38} r={22} fill={skin} />
        <path d="M -22 -40 Q -20 -64 2 -62 Q 24 -60 22 -38 Q 12 -52 -6 -48 Q -16 -46 -22 -40 Z" fill={hair} />
        <circle cx={-12} cy={-38} r={2.2} fill="#1f1a17" />
      </g>
      <g className="patron-arm" style={{ animationDelay: `${delay + 1.3}s` }}>
        <path d="M -16 8 Q -40 30 -54 20" fill="none" stroke={shirt} strokeWidth={14} strokeLinecap="round" />
        <circle cx={-56} cy={19} r={7} fill={skin} />
        {phone && (
          <g>
            <rect x={-68} y={4} width={14} height={24} rx={3} fill="#1f2328" />
            <rect x={-66} y={7} width={10} height={17} rx={1} fill="#9fd3ff" opacity={0.85} />
          </g>
        )}
      </g>
      {/* Legs under the table edge. */}
      <rect x={-22} y={62} width={40} height={16} rx={6} fill="#2f3440" />
    </g>
  );
}

function Cup({ x, delay }: { x: number; delay: number }) {
  return (
    <g>
      <rect x={x - 11} y={TABLE_Y - 22} width={22} height={22} rx={4} fill="#f3efe8" />
      <path d={`M ${x + 11} ${TABLE_Y - 17} q 9 3 0 12`} fill="none" stroke="#f3efe8" strokeWidth={3} />
      <path
        className="particle steam"
        d={`M ${x} ${TABLE_Y - 28} q -6 -10 0 -20 q 6 -10 0 -20`}
        fill="none"
        stroke="#ffffff"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.3}
        style={{ animationDelay: `${delay}s` }}
      />
    </g>
  );
}

/** 0: two people at the next table; 1: two there and one at the counter; 2: one there and one at the counter. */
export function Patrons({ model, empty }: { model: SceneModel; empty: boolean }) {
  const { palette, patrons } = model;
  const [s0, s1, s2] = palette.skin as [string, string, string];
  const atTable = empty ? 0 : patrons === 2 ? 1 : 2;
  return (
    <g className="patrons layer-mid">
      {patrons > 0 && (
        <g className="stool">
          <rect x={940} y={528} width={44} height={9} rx={4} fill={palette.woodDark} />
          <rect x={958} y={537} width={8} height={83} fill="#3d4146" />
          <rect x={944} y={586} width={36} height={4} rx={2} fill="#3d4146" />
        </g>
      )}
      {patrons > 0 && <Figure className="at-counter" x={960} y={452} skin={s2} hair="#3a2a1f" shirt="#6b8f71" facing={-1} delay={2.4} />}
      {atTable >= 1 && <Figure className="at-table" x={1100} y={546} skin={s0} hair="#1f1a17" shirt="#c2463a" facing={-1} phone delay={0} />}
      {atTable >= 2 && <Figure className="at-table" x={1300} y={546} skin={s1} hair="#5a3a22" shirt="#3b6ea5" facing={1} delay={1.1} />}
      <rect x={1040} y={TABLE_Y} width={320} height={14} rx={4} fill={palette.wood} />
      <rect x={1192} y={TABLE_Y + 14} width={16} height={90} fill={palette.woodDark} />
      <rect x={1150} y={TABLE_Y + 100} width={100} height={8} rx={4} fill={palette.woodDark} />
      {atTable >= 1 && <Cup x={1150} delay={0.4} />}
      {atTable >= 2 && <Cup x={1250} delay={1.6} />}
    </g>
  );
}
