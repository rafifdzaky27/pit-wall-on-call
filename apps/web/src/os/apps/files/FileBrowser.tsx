import { useState } from "react";
import type { VFile } from "../../../content/files";
import "./files.css";

const size = (f: VFile) => `${new TextEncoder().encode(f.content).length} B`;

export function FileBrowser({ files, label }: { files: VFile[]; label: string }) {
  const [selected, setSelected] = useState(0);
  const file = files[selected]!;
  return (
    <div className="files">
      <nav className="files-list" aria-label={label}>
        <ul>
          {files.map((f, i) => (
            <li key={f.name}>
              <button type="button" className="file-row" aria-pressed={i === selected} onClick={() => setSelected(i)}>
                <span className="mono">{f.name}</span>
                <span className="muted">{size(f)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <article className="file-view" aria-label={file.name}>
        <h2 className="mono">{file.name}</h2>
        {file.content ? <pre className="file-text">{file.content}</pre> : <p className="empty">{file.note}</p>}
      </article>
    </div>
  );
}
