'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class VideoEditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[FORMA] VideoEditor Unhandled Error Caught:', error, errorInfo);
  }

  handleReset = () => {
    try {
      localStorage.removeItem('forma_active_project');
    } catch {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen flex-col items-center justify-center bg-[#090d16] p-6 text-gray-200 select-none">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-[#121826] p-6 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-red-500/20 pb-4 text-red-400">
              <svg className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h2 className="text-base font-bold text-white">Video Editörü Kurtarma Modu</h2>
            </div>

            <p className="mt-4 text-xs text-gray-300 leading-relaxed">
              Video düzenleme çalışma alanında beklenmeyen bir durum oluştu ancak çalışma verileriniz IndexedDB üzerinde güvende.
            </p>

            {this.state.error?.message && (
              <div className="mt-3 rounded-lg bg-black/50 p-3 font-mono text-[11px] text-red-300 break-all border border-red-900/40">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 rounded-lg bg-[#1c2433] hover:bg-[#253043] text-gray-300 text-xs font-semibold transition-colors"
              >
                Ana Sayfaya Dön
              </button>
              <button
                onClick={this.handleReset}
                className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-lg shadow-indigo-600/30"
              >
                Yeniden Başlat
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
