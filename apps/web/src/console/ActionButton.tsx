import type { ActionDef, RejectReason, Snapshot, State } from "@pitwall/engine";
import type { ReactNode } from "react";

interface Props {
  action: ActionDef<State>;
  snapshot: Snapshot;
  check: (actionId: string) => RejectReason | null;
  onAction: (actionId: string) => void;
  /** What the button says, when it is not the action's label (a DB console command, for example). */
  children?: ReactNode;
  className?: string;
}

/** One engine action as a button, with its progress while it runs, in whichever tool it lives. */
export function ActionButton({ action, snapshot, check, onAction, children, className = "" }: Props) {
  const run = snapshot.busy?.actionId === action.id ? snapshot.busy : snapshot.pending.find((p) => p.actionId === action.id);
  const progress = run ? (snapshot.tick - run.startTick) / (run.endTick - run.startTick) : 0;
  return (
    <button
      type="button"
      className={`btn action${run ? " running" : ""}${className ? ` ${className}` : ""}`}
      data-coach={`action:${action.id}`}
      disabled={check(action.id) !== null}
      onClick={() => onAction(action.id)}
    >
      {children ?? <span>{action.label}</span>}
      <span className="action-d mono">{action.durationS} s</span>
      {run && <span className="action-progress" style={{ width: `${Math.round(progress * 100)}%` }} />}
    </button>
  );
}
