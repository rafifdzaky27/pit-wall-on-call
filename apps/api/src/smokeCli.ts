import { runSmoke } from "./smoke";

/** `node dist/smoke.js http://web:80`, run by deploy.sh inside the api container. */
const base = process.argv[2] ?? "http://127.0.0.1:8787";
try {
  await runSmoke(base);
  console.log(JSON.stringify({ level: "info", msg: "smoke replay ok", base }));
} catch (error) {
  console.error(JSON.stringify({ level: "error", msg: "smoke replay failed", base, error: (error as Error).message }));
  process.exitCode = 1;
}
