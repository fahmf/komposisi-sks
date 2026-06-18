import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Catches render-time crashes so a single bug doesn't blank the whole app and
 *  hide the user's locally-stored data. Offers reload without touching storage. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in the console for diagnostics; data stays intact in localStorage.
    console.error('Render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg p-6 text-center">
        <h1 className="mb-2 text-xl font-bold text-rose-600">Terjadi kesalahan tak terduga</h1>
        <p className="mb-4 text-sm text-slate-500">
          Data Anda tetap aman tersimpan di perangkat ini. Coba muat ulang halaman. Jika berulang,
          ekspor cadangan JSON Anda lalu laporkan masalah ini.
        </p>
        <pre className="mb-4 overflow-x-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {this.state.error.message}
        </pre>
        <button className="btn-primary" onClick={() => window.location.reload()}>
          Muat ulang
        </button>
      </div>
    );
  }
}
