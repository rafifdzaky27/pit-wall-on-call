import { Component, type ReactNode } from "react";

/**
 * Around the shift report: if its chunk is gone (a tab from before a deploy), the end of the run is
 * not a crash and not a reload. The café still leads to the postmortem (M2.5 review I4).
 */
export class ReportBoundary extends Component<{ children: ReactNode; onRead: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="results-scrim">
        <div className="results-card" role="dialog" aria-label="Shift report">
          <div className="results-body">
            <p>The shift report didn't load.</p>
          </div>
          <div className="results-actions">
            <button type="button" className="btn primary" onClick={this.props.onRead}>
              Read the postmortem
            </button>
          </div>
        </div>
      </div>
    );
  }
}
