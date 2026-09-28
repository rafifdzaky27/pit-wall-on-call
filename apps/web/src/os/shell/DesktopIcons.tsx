import { AppIcon } from "../brand/AppIcon";
import { useOs } from "./OsContext";

export function DesktopIcons() {
  const { openApp } = useOs();
  return (
    <ul className="desk-icons" aria-label="Desktop icons">
      <li>
        <button type="button" className="desk-icon" onClick={() => openApp("files")}>
          <AppIcon app="home" size={48} />
          <span>Home</span>
        </button>
      </li>
      <li>
        <button type="button" className="desk-icon" onClick={() => openApp("trash")}>
          <AppIcon app="trash" size={48} />
          <span>Trash</span>
        </button>
      </li>
    </ul>
  );
}
