import React from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<
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
      message: error?.message || 'Terjadi kesalahan antarmuka yang tidak terduga.',
    };
  }

  handleResetApp = () => {
    try {
      window.localStorage.removeItem('ff_auth_token');
      window.localStorage.removeItem('ff_auth_user');
    } catch {
      // ignore storage errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-slate-200 bg-white p-6 space-y-4 shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">
              Terjadi Gangguan Tampilan
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Aplikasi mengalami kesalahan tak terduga saat memuat data. Anda dapat memuat ulang
              halaman atau mengatur ulang sesi lokal.
            </p>
            {this.state.message && (
              <div className="rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700 break-words">
                {this.state.message}
              </div>
            )}
            <div className="flex items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Muat Ulang
              </button>
              <button
                type="button"
                onClick={this.handleResetApp}
                className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800"
              >
                Reset Sesi &amp; Masuk Ulang
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('vite:preloadError', () => {
    try {
      const reloadedKey = 'ff_preload_reloaded';
      if (!window.sessionStorage.getItem(reloadedKey)) {
        window.sessionStorage.setItem(reloadedKey, '1');
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  });
}

if ('serviceWorker' in navigator) {
  try {
    registerSW({
      immediate: true,
      onRegisteredSW() {
        // Service Worker active for Web Push notifications
      },
    });
  } catch {
    // Ignore Service Worker registration failures on restricted contexts
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
