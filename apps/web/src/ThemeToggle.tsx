import { useState } from "react";
import { applyTheme, currentTheme, type Theme } from "./theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  const choose = (next: Theme) => {
    applyTheme(next);
    setTheme(next);
  };
  return (
    <div className="seg" role="group" aria-label="Theme">
      <button type="button" aria-pressed={theme === "dark"} onClick={() => choose("dark")}>
        Dark
      </button>
      <button type="button" aria-pressed={theme === "light"} onClick={() => choose("light")}>
        Light
      </button>
    </div>
  );
}
