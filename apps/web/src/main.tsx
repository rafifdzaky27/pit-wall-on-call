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
import { getScenario } from "@pitwall/scenarios";
import { App } from "./App";
import { applyPrefs, loadPrefs } from "./os/prefs";

// Apply before the first paint so a light-theme player never sees a dark flash.
applyPrefs(loadPrefs());

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing");

// A `?incident=<id>` link pins practice shifts to one incident, to share or to rehearse it.
const pinned = getScenario(new URLSearchParams(window.location.search).get("incident") ?? "");
const practice = pinned && !pinned.training ? pinned : undefined;

createRoot(root).render(
  <StrictMode>
    <App practice={practice} />
  </StrictMode>,
);
