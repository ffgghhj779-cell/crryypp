'use client';

import { Component, ReactNode } from 'react';
import { RefreshCw, AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message ?? '' };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary] Uncaught render error:', error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-black px-8 gap-6"
        style={{ background: 'radial-gradient(ellipse at center, #0a0a0a 0%, #000 100%)' }}
      >
        {/* Glow orb */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-96 bg-orange-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative flex flex-col items-center gap-5 max-w-xs text-center">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-orange-500" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-black text-white tracking-tight">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-base text-white/40 leading-relaxed">
              تعذّر تحميل التطبيق. يرجى إعادة التشغيل.
            </p>
            {this.state.message && (
              <p className="text-sm font-mono text-white/20 break-all mt-2 px-3 py-4 rounded-lg bg-white/[0.03] border border-white/[0.05]">
                {this.state.message}
              </p>
            )}
          </div>

          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-3.5 px-6 py-4 rounded-2xl font-bold text-base text-white transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 0 24px rgba(249,115,22,0.35)' }}
          >
            <RefreshCw className="w-6 h-6" />
            إعادة تشغيل التطبيق
          </button>
        </div>
      </div>
    );
  }
}
