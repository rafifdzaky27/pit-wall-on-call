import { useState } from "react";
import { TRASH_FILES, TRASH_REFUSALS } from "../../../content/files";
import { FileBrowser } from "./FileBrowser";

export function TrashApp() {
  const [tries, setTries] = useState(0);
  return (
    <div className="trash">
      <FileBrowser files={TRASH_FILES} label="Trash" />
      <div className="trash-bar">
        {tries > 0 && (
          <p role="status" className="muted">
            {TRASH_REFUSALS[(tries - 1) % TRASH_REFUSALS.length]}
          </p>
        )}
        <button type="button" className="btn" onClick={() => setTries((t) => t + 1)}>
          Empty Trash
        </button>
      </div>
    </div>
  );
}
