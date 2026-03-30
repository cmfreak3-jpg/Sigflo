import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Sigflo]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-sigflo-bg px-6 py-10 text-center text-sigflo-text">
          <p className="text-sm font-semibold text-white">Something went wrong</p>
          <pre className="mt-4 max-w-lg whitespace-pre-wrap break-words text-left text-xs text-rose-200/90">
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.assign('/feed')}
            className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-6 py-3 text-sm font-bold text-sigflo-bg"
          >
            Back to feed
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
