import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/console.css";
import "./styles/screens.css";
import "./styles/shell.css";
import "./styles/stage.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applyPrefs, loadPrefs } from "./os/prefs";

// Apply before the first paint so a light-theme player never sees a dark flash.
applyPrefs(loadPrefs());

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
