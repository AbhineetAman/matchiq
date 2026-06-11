import { Component } from "react";

export function ErrorState({ message = "Something went wrong while loading data.", onRetry }) {
  return (
    <div className="card p-8 text-center space-y-4">
      <div className="text-4xl">⚠️</div>
      <p className="text-slate-300">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-gold">
          Retry
        </button>
      )}
    </div>
  );
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("MatchIQ render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6">
          <ErrorState
            message="The page hit an unexpected error. Reloading usually fixes it."
            onRetry={() => window.location.reload()}
          />
        </div>
      );
    }
    return this.props.children;
  }
}
