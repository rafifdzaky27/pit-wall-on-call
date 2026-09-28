// Trims the café recordings to short loops (M1.6 plan R1, R10). Run from the repo root:
//   node scripts/ambience.mjs
// Sources go in .cache/ambience/ (downloaded from Wikimedia Commons; see apps/web/public/audio/CREDITS.md).
// Needs ffmpeg on PATH, or FFMPEG=<path to ffmpeg>.
import { execFileSync } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const SRC = ".cache/ambience";
const OUT = "apps/web/public/audio";
const BUDGET = 1_500_000;
const RATE = 8000;
/** Skip the first and last seconds: recordings often start and end with handling noise. */
const EDGE_S = 5;

const JOBS = [
  { src: "cafe-ambiance.ogg", out: "cafe-murmur.mp3", seconds: 45 },
  { src: "rain-window.ogg", out: "rain-window.mp3", seconds: 30 },
];

function rmsPerSecond(file) {
  const pcm = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(RATE), "-f", "s16le", "-"], { maxBuffer: 1 << 30 });
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2));
  const out = [];
  for (let i = 0; i + RATE <= samples.length; i += RATE) {
    let sum = 0;
    for (let j = i; j < i + RATE; j++) sum += samples[j] * samples[j];
    out.push(Math.sqrt(sum / RATE));
  }
  return out;
}

/** The loudest-enough window with the least variation: a steady room, not a quiet corner of it (plan R10). */
function steadiest(rms, seconds) {
  const median = [...rms].sort((a, b) => a - b)[Math.floor(rms.length / 2)];
  let best = null;
  for (let start = EDGE_S; start + seconds <= rms.length - EDGE_S; start++) {
    const win = rms.slice(start, start + seconds);
    const mean = win.reduce((a, b) => a + b, 0) / seconds;
    if (mean < median) continue;
    const sd = Math.sqrt(win.reduce((a, b) => a + (b - mean) ** 2, 0) / seconds);
    const score = sd / mean;
    if (!best || score < best.score) best = { start, score };
  }
  if (!best) throw new Error(`no ${seconds} s window fits`);
  return best;
}

let total = 0;
for (const job of JOBS) {
  const src = join(SRC, job.src);
  const out = join(OUT, job.out);
  const { start, score } = steadiest(rmsPerSecond(src), job.seconds);
  execFileSync(FFMPEG, ["-y", "-v", "error", "-ss", String(start), "-t", String(job.seconds), "-i", src, "-ac", "1", "-ar", "44100", "-b:a", "64k", "-af", "loudnorm=I=-26:TP=-3", out]);
  const size = statSync(out).size;
  total += size;
  console.log(`${job.out}: from ${start} s, ${job.seconds} s, variation ${score.toFixed(3)}, ${size} bytes`);
}
console.log(`total ${total} bytes (budget ${BUDGET})`);
if (total > BUDGET) {
  console.error("over the 1.5 MB audio budget");
  process.exit(1);
}
