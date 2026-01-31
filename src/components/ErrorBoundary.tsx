import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen bg-background-primary text-text-normal p-8">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
          <div className="max-w-2xl w-full bg-background-secondary rounded-lg p-4 overflow-auto">
            <p className="text-sm font-mono text-red-400 mb-2">
              {this.state.error?.message}
            </p>
            {this.state.error?.stack && (
              <pre className="text-xs text-text-muted whitespace-pre-wrap">
                {this.state.error.stack}
              </pre>
            )}
          </div>
          <button
            className="mt-4 px-4 py-2 bg-interactive-accent text-white rounded hover:opacity-90"
            onClick={() => window.location.reload()}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
