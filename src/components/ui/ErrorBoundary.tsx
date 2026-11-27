import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('NAMMAOORU ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      let friendlyDetail =
        'Something went wrong while communicating with the service. Please reload or sign in again.';
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed?.operationType && parsed?.error) {
          friendlyDetail = `Access or database error during ${parsed.operationType} (${parsed.path ?? 'resource'}): ${parsed.error}`;
        }
      } catch {
        if (this.state.message && this.state.message.length < 220) {
          friendlyDetail = this.state.message;
        }
      }

      return (
        <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl border border-[#E2E8E4] bg-white p-6 space-y-4 shadow-sm">
            <div className="flex items-center gap-3 text-[#991B1B]">
              <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
              <h1 className="font-display text-lg font-semibold text-[#1C2420]">
                Unable to Complete Request
              </h1>
            </div>
            <p className="text-sm text-[#526058] leading-relaxed">{friendlyDetail}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#166534]"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
