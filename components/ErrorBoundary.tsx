import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Cortafuegos de render.
 *
 * El panel es una SPA: si un componente lanza una excepción durante el render (un campo con forma
 * inesperada, una sesión que ya no existe, una fecha inválida), React desmonta TODA la aplicación y
 * el asesor ve una pantalla en blanco sin ninguna pista. Este boundary lo evita: muestra qué pasó,
 * deja volver a la lista y registra el error para poder revisarlo.
 */
interface Props {
  children: React.ReactNode;
  label?: string;
  onReset?: () => void;
}

interface State {
  error: Error | null;
  info: string;
}

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const payload = {
      at: new Date().toISOString(),
      label: this.props.label || 'panel',
      message: String(error?.message || error),
      stack: String(error?.stack || '').slice(0, 1500),
      componentStack: String(info?.componentStack || '').slice(0, 1500),
      url: typeof window !== 'undefined' ? window.location.href : '',
    };
    // Guardado local para diagnóstico (últimos 5) y envío best-effort al servidor.
    try {
      const key = 'unitec_render_errors';
      const prev = JSON.parse(window.localStorage.getItem(key) || '[]');
      window.localStorage.setItem(key, JSON.stringify([payload, ...prev].slice(0, 5)));
    } catch {}
    try {
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true,
      }).catch(() => {});
    } catch {}
    // eslint-disable-next-line no-console
    console.error('[render-error]', payload.label, payload.message);
  }

  reset = () => {
    this.setState({ error: null, info: '' });
    try { this.props.onReset?.(); } catch {}
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="p-6">
        <div className="max-w-xl mx-auto rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-amber-600 mt-0.5 shrink-0" size={20} />
            <div className="min-w-0">
              <p className="font-bold text-amber-900">Esta vista no se pudo mostrar</p>
              <p className="text-xs text-amber-800 mt-1 break-words">
                {String(this.state.error.message || this.state.error)}
              </p>
              <p className="text-[11px] text-amber-700 mt-2">
                El error quedó registrado. Puedes volver a la lista o recargar el panel.
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={this.reset}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center gap-1"
                >
                  <RotateCcw size={12} /> Volver
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-800 text-xs font-bold"
                >
                  Recargar panel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
