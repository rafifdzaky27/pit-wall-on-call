import { Component, type ReactNode } from "react";
import { isChunkError, reloadOnce, Reloading } from "../chunks";

interface Props {
  children: ReactNode;
  onReset: () => void;
}

interface State {
  error: Error | null;
  /** A chunk error whose reload was refused (it already reloaded moments ago): a real failure. */
  refused: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, refused: false };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // A missing chunk after a deploy is not a crash: reload onto the new version (M2.5 spec §10).
    if (isChunkError(error)) {
      if (reloadOnce()) return;
      this.setState({ refused: true });
    }
    console.error("simulation crashed", error);
  }

  render() {
    const { error, refused } = this.state;
    if (!error) return this.props.children;
    if (isChunkError(error) && !refused) return <Reloading />;
    return (
      <div className="overlay">
        <div className="card" role="alertdialog" aria-labelledby="crash-h" aria-describedby="crash-d">
          <h2 id="crash-h">The simulation hit an error</h2>
          <p id="crash-d">This run can't continue. Nothing was submitted.</p>
          <details className="crash-details">
            <summary>Error details</summary>
            <pre className="mono">{error.message}</pre>
          </details>
          <button
            type="button"
            className="btn primary"
            autoFocus
            onClick={() => {
              this.setState({ error: null, refused: false });
              this.props.onReset();
            }}
          >
            Back to start
          </button>
        </div>
      </div>
    );
  }
}
