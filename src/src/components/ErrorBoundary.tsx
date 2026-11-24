import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Ocurrió un error inesperado.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#080C14] p-6 text-center">
          <div className="max-w-md rounded-xl border border-rose-500/40 bg-[#0D1422] p-6 shadow-2xl">
            <h2 className="font-display text-xl font-bold text-white">
              Error de aplicación
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              No se pudo completar la operación. Verifica tu conexión o recarga la página.
            </p>
            {this.state.errorMessage && (
              <div className="mt-3 max-h-24 overflow-y-auto rounded-lg bg-slate-950 p-2.5 text-left font-mono text-[11px] text-rose-300">
                {this.state.errorMessage}
              </div>
            )}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 rounded-lg bg-cyan-500 px-5 py-2.5 font-display text-sm font-bold text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
            >
              Recargar juego
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
