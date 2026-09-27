import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  onReset: () => void;
}

export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("simulation crashed", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="overlay">
        <div className="card" role="alertdialog" aria-labelledby="crash-h" aria-describedby="crash-d">
          <h2 id="crash-h">The simulation hit an error</h2>
          <p id="crash-d">This run can't continue. Nothing was submitted.</p>
          <button
            type="button"
            className="btn primary"
            autoFocus
            onClick={() => {
              this.setState({ error: null });
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
