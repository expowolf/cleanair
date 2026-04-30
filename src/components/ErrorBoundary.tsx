import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      try {
        // Check if it's a Firestore error JSON
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error) {
          errorMessage = parsed.error;
        }
      } catch (e) {
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-background">
          <div className="w-20 h-20 bg-secondary/10 rounded-[32px] flex items-center justify-center text-secondary mb-6 shadow-inner">
            <AlertCircle size={40} />
          </div>
          <h2 className="text-2xl font-black text-charcoal mb-4 uppercase tracking-tighter">System Error</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed font-bold opacity-80 uppercase tracking-widest text-[10px]">
            {errorMessage}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-10 py-4 bg-charcoal text-white rounded-full font-black text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-charcoal/20 active:scale-95 transition-all"
          >
            Reboot Protocol
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
