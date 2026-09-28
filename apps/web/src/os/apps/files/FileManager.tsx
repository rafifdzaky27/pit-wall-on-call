import { fillWorld } from "@pitwall/world";
import { useState } from "react";
import { HOME, modifiedLabel, sizeLabel, TRASH, TRASH_REFUSALS, type VDir, type VFile, type VNode } from "../../../content/files";
import { Glyph } from "../../brand/Glyph";
import { Wallpaper } from "../../brand/Wallpaper";
import { useIncident } from "../../incident/IncidentProvider";
import { FileIcon } from "./FileIcon";
import "./files.css";

type Root = "home" | "trash";
interface Loc {
  root: Root;
  path: string[];
}

const ROOTS: Record<Root, VDir> = { home: HOME, trash: TRASH };
const PLACES: { label: string; loc: Loc }[] = [
  { label: "Home", loc: { root: "home", path: [] } },
  { label: "Documents", loc: { root: "home", path: ["Documents"] } },
  { label: "Downloads", loc: { root: "home", path: ["Downloads"] } },
  { label: "Pictures", loc: { root: "home", path: ["Pictures"] } },
  { label: "Trash", loc: { root: "trash", path: [] } },
];

function dirAt(loc: Loc): VDir {
  let dir = ROOTS[loc.root];
  for (const name of loc.path) {
    const next = dir.children.find((n): n is VDir => n.kind === "folder" && n.name === name);
    if (!next) break;
    dir = next;
  }
  return dir;
}

const same = (a: Loc, b: Loc) => a.root === b.root && a.path.join("/") === b.path.join("/");

/** A Nautilus-style file manager (polish spec S22). Folders open on click; files open in the preview. */
export function FileManager({ start }: { start: Root }) {
  const { world } = useIncident();
  const [loc, setLoc] = useState<Loc>({ root: start, path: [] });
  const [back, setBack] = useState<Loc[]>([]);
  const [forward, setForward] = useState<Loc[]>([]);
  const [view, setView] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string | null>(start === "home" ? "README.md" : null);
  const [tries, setTries] = useState(0);
  const dir = dirAt(loc);
  const now = Date.now();
  const file = dir.children.find((n): n is VFile => n.kind !== "folder" && n.name === selected) ?? null;
  const crumbs = [ROOTS[loc.root].name, ...loc.path];

  const go = (next: Loc) => {
    if (same(next, loc)) return;
    setBack((b) => [...b, loc]);
    setForward([]);
    setLoc(next);
    setSelected(null);
  };

  const open = (node: VNode) => {
    if (node.kind === "folder") go({ ...loc, path: [...loc.path, node.name] });
    else setSelected(node.name);
  };

  const item = (node: VNode) => (
    <button type="button" className="naut-item" aria-pressed={node.name === selected} onClick={() => open(node)}>
      <FileIcon kind={node.kind} size={view === "grid" ? 48 : 20} />
      <span className="naut-name">{node.name}</span>
    </button>
  );

  return (
    <div className={file ? "naut with-preview" : "naut"}>
      <header className="naut-bar">
        <div className="naut-nav">
          <button
            type="button"
            className="icon-btn"
            aria-label="Back"
            disabled={back.length === 0}
            onClick={() => {
              setForward((f) => [loc, ...f]);
              setLoc(back.at(-1)!);
              setBack((b) => b.slice(0, -1));
              setSelected(null);
            }}
          >
            <Glyph name="back" />
          </button>
          <button
            type="button"
            className="icon-btn"
            aria-label="Forward"
            disabled={forward.length === 0}
            onClick={() => {
              setBack((b) => [...b, loc]);
              setLoc(forward[0]!);
              setForward((f) => f.slice(1));
              setSelected(null);
            }}
          >
            <Glyph name="forward" />
          </button>
        </div>
        <nav className="naut-path" aria-label="Path">
          {crumbs.map((c, i) => (
            <button key={`${c}-${i}`} type="button" aria-current={i === crumbs.length - 1 ? "location" : undefined} onClick={() => go({ ...loc, path: loc.path.slice(0, i) })}>
              {c}
            </button>
          ))}
        </nav>
        <div className="seg" role="group" aria-label="View">
          <button type="button" aria-pressed={view === "list"} onClick={() => setView("list")}>
            List
          </button>
          <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")}>
            Grid
          </button>
        </div>
        {loc.root === "trash" && (
          <button type="button" className="btn" onClick={() => setTries((t) => t + 1)}>
            Empty Trash
          </button>
        )}
      </header>

      <nav className="naut-side" aria-label="Places">
        <ul>
          {PLACES.map((p) => (
            <li key={p.label}>
              <button type="button" className="naut-place" aria-current={same(p.loc, loc) ? "location" : undefined} onClick={() => go(p.loc)}>
                <FileIcon kind="folder" size={18} />
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <main className="naut-main">
        {loc.root === "trash" && tries > 0 && (
          <p role="status" className="naut-banner">
            {TRASH_REFUSALS[(tries - 1) % TRASH_REFUSALS.length]}
          </p>
        )}
        {dir.children.length === 0 ? (
          <p className="empty naut-empty">Folder is empty</p>
        ) : view === "list" ? (
          <table className="naut-list" aria-label={dir.name}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Size</th>
                <th scope="col">Modified</th>
              </tr>
            </thead>
            <tbody>
              {dir.children.map((n) => (
                <tr key={n.name} className={n.name === selected ? "selected" : undefined}>
                  <td>{item(n)}</td>
                  <td className="muted">{sizeLabel(n)}</td>
                  <td className="muted">{modifiedLabel(n.daysAgo, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <ul className="naut-grid" aria-label={dir.name}>
            {dir.children.map((n) => (
              <li key={n.name}>{item(n)}</li>
            ))}
          </ul>
        )}
      </main>

      {file && (
        <article className="naut-preview" aria-label={file.name}>
          <header>
            <FileIcon kind={file.kind} size={32} />
            <div>
              <h2 className="mono">{file.name}</h2>
              <p className="muted">
                {sizeLabel(file)} · {modifiedLabel(file.daysAgo, now)}
              </p>
            </div>
          </header>
          {file.city ? (
            <div className="naut-image">
              <Wallpaper city={file.city} />
            </div>
          ) : file.content ? (
            <pre className="naut-text">{fillWorld(file.content, world)}</pre>
          ) : (
            <p className="empty">{file.note}</p>
          )}
        </article>
      )}
    </div>
  );
}
