import type { CloseState, SceneModel } from "@pitwall/world";
import { memo, type ReactNode } from "react";
import { SCENE } from "../camera";
import { darken, FONT, lighten, MONO, Plant, Prop, Shadow, toner } from "./kit";

/** The laptop: bezel, hinge and keyboard deck; the live desktop sits on its screen (SCENE.screen). */
export const LAPTOP = { x: 564, y: 454, w: 472, h: 382 } as const;
export const PHONE = { x: 1084, y: 710, w: 104, h: 126 } as const;
/** The rubber duck beside the laptop (M2.5 spec §9). Drawn here; wired to the hint system elsewhere. */
export const DUCK = { x: 484, y: 682, w: 70, h: 64 } as const;

type Tone = ReturnType<typeof toner>;
type Pt = [number, number];

const lerp = (a: Pt, b: Pt, u: number): Pt => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
/** A point inside a four-cornered area, by its share across (u) and down (v). */
const at = (q: [Pt, Pt, Pt, Pt], u: number, v: number): Pt => lerp(lerp(q[0], q[1], u), lerp(q[3], q[2], u), v);
const quad = (q: [Pt, Pt, Pt, Pt], u0: number, v0: number, u1: number, v1: number) => [at(q, u0, v0), at(q, u1, v0), at(q, u1, v1), at(q, u0, v1)].map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

// The deck in perspective: narrow at the hinge, wide at the front edge.
const DECK: [Pt, Pt, Pt, Pt] = [
  [600, 722],
  [1000, 722],
  [1036, 826],
  [564, 826],
];
const WELL: [Pt, Pt, Pt, Pt] = [at(DECK, 0.06, 0.07), at(DECK, 0.94, 0.07), at(DECK, 0.94, 0.63), at(DECK, 0.06, 0.63)];
/** Key widths per row, in units; each row fills the well. */
const ROWS: number[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.6],
  [1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.1],
  [1.8, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.8],
  [2.3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2.3],
  [1, 1, 1, 1.3, 5.4, 1.3, 1, 1, 1],
];
const ROW_H = [0.11, 0.178, 0.178, 0.178, 0.178, 0.178];

function Keyboard({ night }: { night: boolean }) {
  const keys: ReactNode[] = [];
  let v = 0;
  ROWS.forEach((row, r) => {
    const total = row.reduce((a, b) => a + b, 0);
    const h = ROW_H[r]!;
    let u = 0;
    row.forEach((w, k) => {
      const u0 = u / total + 0.004;
      const u1 = (u + w) / total - 0.004;
      const v0 = v + 0.022;
      const v1 = v + h - 0.022;
      keys.push(
        <g key={`${r}-${k}`}>
          <polygon points={quad(WELL, u0, v0, u1, v1)} fill="#23272d" />
          <polygon points={quad(WELL, u0 + 0.002, v0, u1 - 0.002, v0 + (v1 - v0) * 0.3)} fill="#3a4049" />
          {night && r > 0 && w < 2 && <polygon points={quad(WELL, u0 + (u1 - u0) * 0.35, v0 + (v1 - v0) * 0.35, u1 - (u1 - u0) * 0.35, v1 - (v1 - v0) * 0.35)} fill="#cfe0ff" opacity={0.35} />}
        </g>,
      );
      u += w;
    });
    v += h;
  });
  return (
    <Prop name="keyboard">
      <polygon points={quad(DECK, 0.06, 0.07, 0.94, 0.63)} fill="#1a1d22" opacity={0.85} />
      {keys}
    </Prop>
  );
}

function Stickers() {
  return (
    <>
      <Prop name="sticker-works-on-my-machine" transform="rotate(-4 640 808)">
        <rect x={596} y={796} width={92} height={24} rx={5} fill="#f6f1e6" />
        <rect x={598} y={798} width={88} height={20} rx={4} fill="#d8434e" />
        <text x={642} y={806} textAnchor="middle" fontFamily={FONT} fontSize={7} fontWeight={800} fill="#ffffff">
          <tspan x={642}>WORKS ON </tspan>
          <tspan x={642} dy={8}>
            MY MACHINE
          </tspan>
        </text>
      </Prop>
      <Prop name="sticker-always-dns" transform="rotate(5 950 806)">
        <rect x={910} y={798} width={78} height={17} rx={8.5} fill="#2f4858" />
        <text x={949} y={809} textAnchor="middle" fontFamily={FONT} fontSize={6.4} fontWeight={700} fill="#f7d67a">
          IT&apos;S ALWAYS DNS
        </text>
      </Prop>
      <Prop name="sticker-lgtm">
        <polygon points="998,800 1008,794 1018,800 1018,812 1008,818 998,812" fill="#6bdc7b" />
        <text x={1008} y={808.5} textAnchor="middle" fontFamily={MONO} fontSize={5.6} fontWeight={700} fill="#1f1a17">
          LGTM
        </text>
      </Prop>
    </>
  );
}

function Laptop({ model, t }: { model: SceneModel; t: Tone }) {
  const s = SCENE.screen;
  const night = model.time === "night" || model.time === "dusk";
  return (
    <Prop name="laptop" className="laptop">
      <Shadow cx={800} cy={830} rx={270} ry={16} o={0.6} />
      {/* The lid: a thin aluminium rim round a black glass bezel, with the camera at the top. */}
      <rect x={596} y={454} width={408} height={266} rx={13} fill={t("#b9bec6", 0.6)} />
      <rect x={598} y={456} width={404} height={262} rx={11} fill="url(#cf-graphite)" />
      <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#0b0d12" />
      <circle cx={800} cy={463} r={2.6} fill="#2a2e35" />
      <circle cx={800} cy={463} r={1.1} fill="#4a6a8a" />
      <path d="M 604 460 L 700 460 L 620 560 L 604 580 Z" fill="#ffffff" opacity={0.04} />
      {/* The hinge. */}
      <rect x={604} y={716} width={392} height={8} rx={3} fill={t("#5a5f66", 0.6)} />
      <rect x={604} y={716} width={392} height={2} rx={1} fill="#ffffff" opacity={0.2} />
      {/* The deck, its front lip, the keyboard and the trackpad. */}
      <polygon points={quad(DECK, 0, 0, 1, 1)} fill="url(#cf-deck)" />
      <polygon points={quad(DECK, 0, 0, 1, 0.05)} fill="#000000" opacity={0.18} />
      <polygon points="564,826 1036,826 1033,834 567,834" fill={t("#7d858e", 0.6)} />
      <polygon points="564,826 1036,826 1035,828 565,828" fill="#ffffff" opacity={0.35} />
      <Keyboard night={night} />
      <Prop name="trackpad">
        <polygon points={quad(DECK, 0.34, 0.7, 0.66, 0.95)} fill={t("#b4bac2", 0.6)} />
        <polygon points={quad(DECK, 0.34, 0.7, 0.66, 0.95)} fill="none" stroke={t("#8d949d", 0.6)} strokeWidth={1.2} />
      </Prop>
      <Stickers />
    </Prop>
  );
}

function Latte({ steaming, t }: { steaming: boolean; t: Tone }) {
  return (
    <Prop name="latte" className="cup">
      <Shadow cx={412} cy={798} rx={70} ry={14} o={0.6} />
      <ellipse cx={408} cy={792} rx={60} ry={18} fill={t("#e9e3d8")} />
      <ellipse cx={408} cy={790} rx={44} ry={12} fill={t("#d8d0c2")} />
      <path d="M 372 740 L 444 740 L 438 790 Q 408 802 378 790 Z" fill={t("#f3efe8")} />
      <path d="M 420 740 L 444 740 L 438 790 Q 428 796 418 797 Z" fill={t("#d8d0c2")} opacity={0.8} />
      <path d="M 443 752 q 24 4 0 30" fill="none" stroke={t("#f3efe8")} strokeWidth={7} />
      <ellipse cx={408} cy={740} rx={36} ry={11} fill={t("#f3efe8")} />
      <ellipse cx={408} cy={741} rx={32} ry={9} fill={t("#a86a3a")} />
      {/* Latte art: a rosetta, poured from the front. */}
      <path d="M 408 734 q -12 3 -14 7 q 14 4 28 0 q -2 -4 -14 -7 Z" fill={t("#f6ead6")} />
      {[0, 1, 2].map((i) => (
        <path key={i} d={`M ${396 + i * 2} ${737 + i * 2} q 12 ${-2 + i} 24 0`} fill="none" stroke={t("#a86a3a")} strokeWidth={1.1} />
      ))}
      <path d="M 408 734 L 408 747" stroke={t("#f6ead6")} strokeWidth={1.4} />
      <path d="M 350 796 L 384 790" stroke="url(#cf-chrome)" strokeWidth={3} strokeLinecap="round" />
      {steaming &&
        [0, 1, 2].map((i) => (
          <path
            key={i}
            className="particle steam cup-steam"
            d={`M ${394 + i * 14} 728 q -8 -14 0 -28 q 8 -14 0 -28`}
            fill="none"
            stroke="#ffffff"
            strokeWidth={4}
            strokeLinecap="round"
            opacity={0.35}
            style={{ animationDelay: `${i * 0.8}s` }}
          />
        ))}
    </Prop>
  );
}

function Notebook({ t }: { t: Tone }) {
  return (
    <Prop name="notebook" className="notebook" transform="rotate(-8 320 800)">
      <Shadow cx={322} cy={834} rx={84} ry={8} o={0.5} />
      <rect x={250} y={764} width={146} height={70} rx={4} fill={t("#2f4858")} />
      <rect x={256} y={766} width={136} height={64} rx={2} fill={t("#f6f1e6")} />
      <line x1={324} y1={766} x2={324} y2={830} stroke={t("#c9c0ae")} strokeWidth={2} />
      {[0, 1, 2, 3].map((i) => (
        <line key={i} x1={262} y1={780 + i * 12} x2={386} y2={780 + i * 12} stroke={t("#b9c4cc")} strokeWidth={0.8} />
      ))}
      {/* A half-drawn diagram: api to db, and a question. */}
      <rect x={266} y={774} width={20} height={11} rx={2} fill="none" stroke={t("#3b4a5a")} strokeWidth={1.2} />
      <rect x={294} y={794} width={20} height={11} rx={2} fill="none" stroke={t("#3b4a5a")} strokeWidth={1.2} />
      <path d="M 280 786 q 4 8 14 10" fill="none" stroke={t("#3b4a5a")} strokeWidth={1.2} />
      <text x={332} y={784} fontFamily={FONT} fontSize={7} fontStyle="italic" fill={t("#3b4a5a")}>
        what changed?
      </text>
      <path d="M 334 800 q 16 -6 30 0 t 22 0" fill="none" stroke={t("#c2463a")} strokeWidth={1.2} />
      <rect x={384} y={748} width={6} height={90} rx={3} fill={t("#e0a43a")} transform="rotate(28 387 793)" />
      <path d="M 405 830 l 4 8 l -8 -2 z" fill={t("#3d3d3d")} transform="rotate(28 387 793)" />
    </Prop>
  );
}

function Duck({ t }: { t: Tone }) {
  const { x, y } = DUCK;
  return (
    <Prop name="rubber-duck" className="duck">
      <Shadow cx={x + 36} cy={y + 60} rx={34} ry={6} o={0.55} />
      <path d={`M ${x + 6} ${y + 40} Q ${x + 2} ${y + 60} ${x + 34} ${y + 60} Q ${x + 64} ${y + 60} ${x + 62} ${y + 40} Q ${x + 60} ${y + 30} ${x + 44} ${y + 32} L ${x + 18} ${y + 32} Q ${x + 8} ${y + 32} ${x + 6} ${y + 40} Z`} fill={t("#f7cf3a")} />
      <path d={`M ${x + 8} ${y + 50} Q ${x + 30} ${y + 62} ${x + 60} ${y + 48} Q ${x + 58} ${y + 60} ${x + 34} ${y + 60} Q ${x + 10} ${y + 60} ${x + 8} ${y + 50} Z`} fill={t("#d8a520")} />
      <path d={`M ${x + 2} ${y + 38} Q ${x - 4} ${y + 28} ${x + 6} ${y + 30}`} fill={t("#f7cf3a")} />
      <circle cx={x + 46} cy={y + 20} r={15} fill={t("#f7cf3a")} />
      <path d={`M ${x + 58} ${y + 22} Q ${x + 72} ${y + 20} ${x + 70} ${y + 27} Q ${x + 64} ${y + 31} ${x + 57} ${y + 28} Z`} fill={t("#f07a2a")} />
      <circle cx={x + 50} cy={y + 16} r={2.6} fill="#1f1a17" />
      <circle cx={x + 51} cy={y + 15} r={0.9} fill="#ffffff" />
      <path d={`M ${x + 22} ${y + 38} Q ${x + 34} ${y + 34} ${x + 42} ${y + 44} Q ${x + 30} ${y + 48} ${x + 22} ${y + 38} Z`} fill={t("#e8b82a")} />
      <ellipse cx={x + 40} cy={y + 12} rx={5} ry={3} fill="#ffffff" opacity={0.5} />
    </Prop>
  );
}

function Earbuds({ t }: { t: Tone }) {
  return (
    <Prop name="earbuds">
      <Shadow cx={1240} cy={820} rx={30} ry={5} />
      <rect x={1220} y={798} width={40} height={24} rx={11} fill={t("#f3f3f1")} />
      <rect x={1220} y={806} width={40} height={1.2} fill={t("#c9ccd2")} />
      <circle cx={1240} cy={814} r={1.6} fill={t("#6bdc7b")} />
      <path d="M 1270 814 q 6 -8 12 -2 l -2 10" fill="none" stroke={t("#f3f3f1")} strokeWidth={5} strokeLinecap="round" />
      <path d="M 1288 820 q 6 -8 12 -2 l -2 10" fill="none" stroke={t("#f3f3f1")} strokeWidth={5} strokeLinecap="round" />
    </Prop>
  );
}

function TableThings({ model, t }: { model: SceneModel; t: Tone }) {
  const style = model.sign.decor.style;
  return (
    <>
      <Prop name="succulent">
        <Plant x={336} y={722} s={0.8} pot={t("#e6d3a3")} leaf={t("#7aa88a")} kind="round" seed={51} />
      </Prop>
      <Prop name="pastry-plate">
        <Shadow cx={1272} cy={744} rx={52} ry={8} />
        <ellipse cx={1270} cy={738} rx={46} ry={12} fill={t("#f3efe8")} />
        <ellipse cx={1270} cy={737} rx={34} ry={8} fill={t("#e3dbcf")} />
        {style === "joglo" ? (
          [0, 1, 2].map((i) => <ellipse key={i} cx={1254 + i * 16} cy={733} rx={9} ry={5} fill={t("#e8c890")} />)
        ) : style === "kissaten" ? (
          <g>
            <path d="M 1256 736 L 1260 720 L 1280 720 L 1284 736 Z" fill={t("#f2c46a")} />
            <path d="M 1260 720 L 1280 720 L 1279 725 L 1261 725 Z" fill={t("#6b3a1a")} />
          </g>
        ) : (
          <path d="M 1246 736 Q 1250 718 1270 722 Q 1290 718 1294 736 Q 1270 742 1246 736 Z" fill={t("#d89a4a")} />
        )}
      </Prop>
      <Prop name="water-glass">
        <Shadow cx={1340} cy={792} rx={18} ry={4} />
        <path d="M 1326 744 L 1354 744 L 1350 790 L 1330 790 Z" fill={t("#dfe7ef")} opacity={0.35} />
        <path d="M 1328 762 L 1352 762 L 1350 790 L 1330 790 Z" fill={t("#bcd6e8")} opacity={0.35} />
        <path d="M 1330 748 L 1333 786" stroke="#ffffff" strokeWidth={2} opacity={0.6} />
      </Prop>
      <Prop name="sticky-note" transform="rotate(8 494 810)">
        <rect x={472} y={792} width={44} height={38} fill={t("#f7e27a")} />
        <rect x={472} y={792} width={44} height={6} fill="#000000" opacity={0.05} />
        <text x={494} y={808} textAnchor="middle" fontFamily={FONT} fontSize={7} fontStyle="italic" fill={t("#3a3020")}>
          roll back
        </text>
        <text x={494} y={818} textAnchor="middle" fontFamily={FONT} fontSize={7} fontStyle="italic" fill={t("#3a3020")}>
          first?
        </text>
      </Prop>
      <Prop name="sugar-sachets">
        <rect x={452} y={760} width={8} height={24} rx={1} fill={t("#e0a43a")} transform="rotate(-20 456 772)" />
        <rect x={462} y={764} width={8} height={24} rx={1} fill={t("#f3efe6")} transform="rotate(10 466 776)" />
      </Prop>
    </>
  );
}

/** The player's table (M2.5 spec §12, the room layer's front): laptop, latte, notebook, earbuds and the duck. */
export const Table = memo(function Table({ model, close }: { model: SceneModel; close: CloseState | null }) {
  const t = toner(model);
  return (
    <g className="table layer-near">
      <Prop name="player-table">
        <path d="M 160 940 L 300 700 L 1300 700 L 1440 940 Z" fill="url(#cf-table)" />
        <path d="M 160 940 L 300 700 L 1300 700 L 1440 940 Z" fill="url(#cf-grain)" />
        <path d="M 300 700 L 1300 700 L 1304 707 L 296 707 Z" fill={t(lighten(model.palette.wood, 0.2))} />
        <path d="M 296 707 L 1304 707 L 1310 714 L 292 714 Z" fill={darken(model.palette.woodDark, 0.2)} opacity={0.5} />
      </Prop>
      <TableThings model={model} t={t} />
      <Notebook t={t} />
      <Latte steaming={close !== "cooled" && close !== "late"} t={t} />
      <Duck t={t} />
      <Earbuds t={t} />
      <Laptop model={model} t={t} />
    </g>
  );
});

/** The phone's pill island: compact, or a live pager activity while it rings (M2.5 spec D1). */
function Island({ live, text }: { live: boolean; text: string }) {
  if (!live) return <rect className="island" x={-11} y={-67} width={22} height={6.5} rx={3.25} fill="#050506" />;
  return (
    <g className="island live">
      <rect x={-32} y={-68.5} width={64} height={11} rx={5.5} fill="#050506" />
      <circle className="island-dot" cx={-27} cy={-63} r={2} fill="#ff5a4a" />
      <text x={-23.5} y={-61.6} fontFamily={FONT} fontSize={3.8} fontWeight={600} fill="#ffffff">
        {text}
      </text>
    </g>
  );
}

export interface TablePhoneProps {
  ringing: boolean;
  paged: boolean;
  page: { severity: string; title: string };
  clock: string;
  hhmm: string;
  mention: string | null;
}

/** "Checkout returning 5xx" becomes "Checkout 5xx" in the island, which has room for little. */
export const shortTitle = (title: string) => title.replace(/\s+returning\s+/i, " ");

/** A modern slab phone lying on the table: thin bezels, a pill island, a lock screen (M2.5 spec D1). */
export const TablePhone = memo(function TablePhone({ ringing, paged, page, clock, hhmm, mention }: TablePhoneProps) {
  const [first, ...rest] = page.title.split(" ");
  const line1 = [first, rest.shift()].filter(Boolean).join(" ");
  return (
    <Prop name="phone" className={`phone${ringing ? " ringing" : ""}`}>
      {ringing && <ellipse className="phone-glow" cx={1136} cy={776} rx={84} ry={50} fill="#ff7a5c" opacity={0.28} />}
      <g transform="translate(1136 772) rotate(-8) scale(1 0.8)">
        <g className="phone-buzz">
          <rect x={-35} y={-72} width={76} height={152} rx={14} fill="#000000" opacity={0.35} />
          <rect x={-37} y={-76} width={74} height={152} rx={14} fill="url(#cf-graphite)" />
          <rect x={-37} y={-76} width={74} height={152} rx={14} fill="none" stroke="#8a929c" strokeWidth={1} opacity={0.7} />
          <rect x={-34.5} y={-73.5} width={69} height={147} rx={11.5} fill="url(#cf-wallpaper)" opacity={ringing ? 1 : 0.55} />
          <path d="M -34 40 Q -10 10 12 30 Q 24 20 34 26 L 34 62 Q 34 73 23 73 L -23 73 Q -34 73 -34 62 Z" fill="#1c1a3a" opacity={0.85} />
          <circle cx={16} cy={-6} r={9} fill="#ffe2b0" opacity={0.85} />
          <text x={0} y={-36} textAnchor="middle" fontFamily={FONT} fontSize={4.6} fill="#ffffff" opacity={0.85}>
            Locked
          </text>
          <text x={0} y={-20} textAnchor="middle" fontFamily={FONT} fontSize={17} fontWeight={300} fill="#ffffff">
            {hhmm}
          </text>
          {(ringing || paged) && (
            <g>
              <rect x={-30} y={-12} width={60} height={26} rx={5} fill="#ffffff" opacity={0.9} />
              <rect x={-27} y={-9} width={15} height={7} rx={1.5} fill="#c2463a" />
              <text x={-19.5} y={-3.8} textAnchor="middle" fontFamily={FONT} fontSize={5} fontWeight={700} fill="#ffffff">
                {page.severity}
              </text>
              <text x={-27} y={5} fontFamily={FONT} fontSize={5} fontWeight={600} fill="#1f1a17">
                <tspan x={-27}>{line1} </tspan>
                <tspan x={-27} dy={6}>
                  {rest.join(" ")}
                </tspan>
              </text>
            </g>
          )}
          {paged && mention && (
            <g>
              <rect x={-30} y={17} width={60} height={14} rx={5} fill="#ffffff" opacity={0.8} />
              <text x={-27} y={25.6} fontFamily={FONT} fontSize={4.4} fill="#1f1a17">
                {mention}
              </text>
            </g>
          )}
          <rect x={-12} y={67} width={24} height={1.6} rx={0.8} fill="#ffffff" opacity={0.7} />
          <Island live={ringing} text={`${page.severity} · ${shortTitle(page.title)} · ${clock}`} />
          <path d="M -30 -70 L -6 -70 L -34 -10 Z" fill="#ffffff" opacity={0.08} />
        </g>
      </g>
      {ringing && <title>{`${page.severity} · ${page.title}`}</title>}
    </Prop>
  );
});
