import type { SceneModel } from "@pitwall/world";

/** The window opening in scene units; everything in this file is clipped to it. */
export const WINDOW = { x: 80, y: 90, w: 680, h: 430 } as const;
const BASELINE = 430;
const RAIN_DROPS = 90;

function Skyline({ model }: { model: SceneModel }) {
  const lit = model.time === "dusk" || model.time === "night";
  return (
    <g className="skyline">
      {model.sign.skyline.map(([x, w, h], i) => (
        <g key={i}>
          <rect x={x} y={BASELINE - h} width={w} height={h} fill={model.palette.buildings} opacity={0.75 + (i % 3) * 0.08} />
          {lit &&
            Array.from({ length: Math.floor((h - 20) / 22) * Math.floor((w - 12) / 18) }, (_, j) => {
              const cols = Math.floor((w - 12) / 18);
              const cx = x + 8 + (j % cols) * 18;
              const cy = BASELINE - h + 12 + Math.floor(j / cols) * 22;
              // A fixed pattern of lit windows, so the same city looks the same every night.
              return (j * 7 + i * 3) % 5 < 2 ? <rect key={j} className="lit-window" x={cx} y={cy} width={6} height={9} fill="#ffd98a" style={{ animationDelay: `${(j % 7) * 1.1}s` }} /> : null;
            })}
        </g>
      ))}
    </g>
  );
}

function Walker({ y, raining, coat, className }: { y: number; raining: boolean; coat: string; className: string }) {
  return (
    <g className={`particle walker ${className}`}>
      <g transform={`translate(0 ${y})`}>
        <circle cx={0} cy={-46} r={8} fill="#2a2320" />
        <rect x={-8} y={-38} width={16} height={34} rx={6} fill={coat} />
        <rect x={-6} y={-6} width={5} height={16} fill="#2a2320" />
        <rect x={1} y={-6} width={5} height={16} fill="#2a2320" />
        {raining && (
          <g>
            <line x1={10} y1={-30} x2={10} y2={-66} stroke="#2a2320" strokeWidth={2} />
            <path d="M -18 -64 Q 10 -92 38 -64 Z" fill={coat === "#4a6b8a" ? "#c2463a" : "#2f4858"} />
          </g>
        )}
      </g>
    </g>
  );
}

function Prop({ model }: { model: SceneModel }) {
  const prop = model.sign.prop;
  if (prop === "vending") {
    return (
      <g className="prop-vending">
        <rect x={630} y={340} width={70} height={92} rx={4} fill="#d9dde3" />
        <rect className="vending-glow" x={638} y={348} width={54} height={50} fill="#bfe6ff" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={642 + i * 17} y={354} width={12} height={16} rx={2} fill={["#c2463a", "#3b7d4f", "#e0a43a"][i]} />
        ))}
        <rect x={645} y={408} width={40} height={10} fill="#39404c" />
      </g>
    );
  }
  if (prop === "tram") {
    return (
      <g className="prop-tram">
        <line x1={WINDOW.x} y1={170} x2={WINDOW.x + WINDOW.w} y2={176} stroke="#2a2d33" strokeWidth={2} />
        <line x1={WINDOW.x} y1={182} x2={WINDOW.x + WINDOW.w} y2={186} stroke="#2a2d33" strokeWidth={1.5} />
        <g className="tram">
          <rect x={0} y={330} width={380} height={100} rx={12} fill="#2e7d4f" />
          <rect x={0} y={330} width={380} height={18} rx={9} fill="#f2efe6" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={20 + i * 58} y={356} width={44} height={34} rx={4} fill="#cfe3ee" opacity={0.85} />
          ))}
          <line x1={190} y1={330} x2={200} y2={176} stroke="#2a2d33" strokeWidth={2} />
        </g>
      </g>
    );
  }
  if (prop === "becak") {
    return (
      <g className="prop-becak mover">
        <g transform={`translate(0 ${BASELINE})`}>
          <path d="M 0 -58 Q 30 -86 62 -58 L 62 -30 L 0 -30 Z" fill="#c2463a" />
          <rect x={4} y={-34} width={56} height={14} rx={4} fill="#3b6ea5" />
          <circle cx={10} cy={-10} r={10} fill="none" stroke="#222" strokeWidth={3} />
          <circle cx={56} cy={-10} r={10} fill="none" stroke="#222" strokeWidth={3} />
          <line x1={62} y1={-26} x2={96} y2={-12} stroke="#222" strokeWidth={3} />
          <circle cx={98} cy={-10} r={10} fill="none" stroke="#222" strokeWidth={3} />
          <circle cx={84} cy={-58} r={7} fill="#2a2320" />
          <rect x={78} y={-51} width={12} height={22} rx={4} fill="#e6d3a3" />
        </g>
      </g>
    );
  }
  return (
    <g className="prop-scooter mover">
      <g transform={`translate(0 ${BASELINE})`}>
        <path d="M 6 -22 L 30 -22 L 46 -40 L 58 -40 L 62 -22 L 72 -22 L 70 -12 L 4 -12 Z" fill="#e0a43a" />
        <circle cx={12} cy={-8} r={9} fill="#222" />
        <circle cx={64} cy={-8} r={9} fill="#222" />
        <circle cx={34} cy={-62} r={8} fill="#3b7d4f" />
        <rect x={27} y={-54} width={14} height={26} rx={5} fill="#2f4858" />
      </g>
    </g>
  );
}

/** Everything seen through the window: sky, the city, a street prop, people, cars' lights and rain. */
export function Street({ model }: { model: SceneModel }) {
  const { palette, weather, time } = model;
  const raining = weather === "rain";
  const dark = time === "dusk" || time === "night";
  return (
    <g className="street">
      <defs>
        <linearGradient id="cafe-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={palette.skyTop} />
          <stop offset="1" stopColor={palette.skyBottom} />
        </linearGradient>
        <clipPath id="cafe-window">
          <rect x={WINDOW.x} y={WINDOW.y} width={WINDOW.w} height={WINDOW.h} />
        </clipPath>
      </defs>
      <g clipPath="url(#cafe-window)">
        {/* Parallax moves the view inside a fixed window, so the frame never shows a gap. */}
        <g className="layer-far">
        <rect x={WINDOW.x - 20} y={WINDOW.y - 20} width={WINDOW.w + 40} height={WINDOW.h + 40} fill="url(#cafe-sky)" />
        <Skyline model={model} />
        <rect x={WINDOW.x - 20} y={BASELINE} width={WINDOW.w + 40} height={WINDOW.h} fill={palette.street} />
        <rect x={WINDOW.x - 20} y={BASELINE + 44} width={WINDOW.w + 40} height={4} fill="#ffffff" opacity={0.18} />
        <Prop model={model} />
        <Walker y={BASELINE + 34} raining={raining} coat="#4a6b8a" className="walker-a" />
        <Walker y={BASELINE + 40} raining={raining} coat="#8a5a4a" className="walker-b" />
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
}
