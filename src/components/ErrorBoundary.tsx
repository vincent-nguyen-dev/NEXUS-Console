// A drawing error replaces the page with a plain message instead of a blank screen.
import { Component, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override render() {
    if (this.state.error === null) return this.props.children;
    return (
      <main id="main" tabIndex={-1} className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-16">
        <h1 className="font-display text-xl font-semibold">Something went wrong while drawing this page</h1>
        <p className="font-mono text-sm text-muted">{this.state.error.message}</p>
        <div>
          <button type="button" onClick={() => window.location.reload()} className="min-h-11 rounded-sm bg-raised px-4 text-base font-medium">
            Reload
          </button>
        </div>
      </main>
    );
  }
}
