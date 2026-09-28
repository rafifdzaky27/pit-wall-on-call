import { ABOUT_TXT } from "./aboutRafif";

export interface VFile {
  name: string;
  content: string;
  /** Shown instead of the content when the file is empty. */
  note?: string;
}

const README = `# Pit Wall On-Call

## How to play
1. Start a shift from the notification or from Monitoring.
2. Before the page you have a few free seconds. Look around: Chat and the phone may hold clues.
3. When the pager goes off, the incident clock starts. Acknowledge fast (A).
4. Investigate in Monitoring. Every action takes time, and some make things worse.
5. The run ends when the fix holds for 10 seconds, or when time runs out.
6. Read the postmortem: where the error budget went, and one lesson.

## Keyboard
O overview · M maximize · [ and ] snap · X close · A acknowledge · P pause
Settings → Accessibility turns single-key shortcuts off.
`;

export const HOME_FILES: VFile[] = [
  { name: "about-rafif.txt", content: ABOUT_TXT },
  { name: "README.md", content: README },
];

export const TRASH_FILES: VFile[] = [
  { name: "final_final_v3.yaml", content: 'replicas: 1        # was 3, "temporarily"\ntimeout: 0         # infinite is a kind of fast\nretries: 1000000   # it will work eventually\n' },
  { name: "prod-backup.sql", content: "", note: "0 bytes. Last night's backup job reported success anyway." },
  { name: "postmortem-draft-DO-NOT-READ.md", content: "## Root cause\nIt was DNS.\n\n## Actually\nIt was not DNS. It is never DNS.\n\n## Actually actually\nIt was DNS.\n" },
  { name: "rackets-compared-v12.csv", content: "racket,weight_g,balance_mm,swingweight,verdict\nA,300,320,290,maybe\nB,305,315,295,maybe\nC,300,320,291,need to hit with it first\n" },
];

export const TRASH_REFUSALS: readonly string[] = [
  "Empty Trash refused: final_final_v3.yaml is load-bearing.",
  "Empty Trash refused: someone might still need prod-backup.sql. It is 0 bytes, but still.",
  "Empty Trash refused: the racket spreadsheet is still under review.",
];
