import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyPrefs, loadPrefs, savePrefs, type Prefs } from "./prefs";

interface PrefsValue {
  prefs: Prefs;
  update: (patch: Partial<Prefs>) => void;
}

const PrefsContext = createContext<PrefsValue | null>(null);

export function PrefsProvider({ children, initial }: { children: ReactNode; initial?: Prefs }) {
  const [prefs, setPrefs] = useState<Prefs>(() => initial ?? loadPrefs());

  useEffect(() => {
    applyPrefs(prefs);
    savePrefs(prefs);
  }, [prefs]);

  const update = useCallback((patch: Partial<Prefs>) => setPrefs((p) => ({ ...p, ...patch })), []);
  const value = useMemo(() => ({ prefs, update }), [prefs, update]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsValue {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return value;
}

/** The prefs, or null outside a provider: for code that also runs in isolated tests (the incident session). */
export function useOptionalPrefs(): PrefsValue | null {
  return useContext(PrefsContext);
}
