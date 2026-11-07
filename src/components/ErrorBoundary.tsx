import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#240605] p-6 text-center text-[#f7ead2]">
          <div className="max-w-md rounded-2xl border border-[#ff5d1f]/30 bg-[#1c0405] p-6 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-[#ff5d1f]">Something went wrong</h2>
            <p className="mt-2 text-xs text-[#f7ead2]/70 font-body">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="mt-5 rounded-full bg-[#ff5d1f] px-5 py-2 font-body text-xs font-bold uppercase tracking-wider text-[#fff6e6] hover:bg-[#ffb15e] hover:text-[#3a0a06]"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
