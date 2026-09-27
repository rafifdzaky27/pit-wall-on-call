import type { LogEntry, RejectReason, ScenarioDef, Snapshot, State } from "@pitwall/engine";
import { useCallback, useEffect, useState } from "react";
import { ActionsPanel } from "./ActionsPanel";
import { AlertFeed } from "./AlertFeed";
import { LogStream } from "./LogStream";
import { MetricPanel } from "./MetricPanel";
import { SceneNotes } from "./SceneNotes";
import { ServiceMap } from "./ServiceMap";
import { TopBar } from "./TopBar";

export interface ConsoleProps {
  scenario: ScenarioDef<State>;
  snapshot: Snapshot;
  logs: readonly LogEntry[];
  history: Record<string, number[]>;
  brand: string;
  check: (actionId: string) => RejectReason | null;
  onAction: (actionId: string) => void;
  onPause: () => void;
}

export function Console({ scenario, snapshot, logs, history, brand, check, onAction, onPause }: ConsoleProps) {
  const [selected, setSelected] = useState(scenario.services[0]!.id);
  const [filter, setFilter] = useState<string | null>(null);

  const select = useCallback((serviceId: string) => {
    setSelected(serviceId);
    setFilter(serviceId);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        setFilter(null);
        return;
      }
      const index = Number(e.key);
      const svc = Number.isInteger(index) && index > 0 ? scenario.services[index - 1] : undefined;
      if (svc) select(svc.id);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenario, select]);

  const service = scenario.services.find((s) => s.id === selected)!;
  const metrics = scenario.metrics.filter((m) => m.serviceId === selected).slice(0, 2);

  return (
    <div className="console">
      <TopBar scenario={scenario} snapshot={snapshot} onPause={onPause} />
      <main className="console-main">
        <div className="col col-left">
          <AlertFeed scenario={scenario} alerts={snapshot.alerts} />
          <SceneNotes scenario={scenario} inspected={snapshot.inspected} brand={brand} />
        </div>
        <div className="col col-center">
          <ServiceMap scenario={scenario} health={snapshot.health} details={snapshot.details} selected={selected} onSelect={select} />
          <div className="charts">
            {metrics.map((m) => (
              <MetricPanel key={m.id} metric={m} value={snapshot.metrics[m.id] ?? 0} history={history[m.id] ?? []} />
            ))}
          </div>
        </div>
        <div className="col col-right">
          <ActionsPanel scenario={scenario} service={service} snapshot={snapshot} check={check} onAction={onAction} />
        </div>
      </main>
      <LogStream scenario={scenario} logs={logs} filter={filter} onClearFilter={() => setFilter(null)} />
    </div>
  );
}
