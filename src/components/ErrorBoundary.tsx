import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

// Sin esto, un error de render en cualquier pantalla (una que llegue con datos
// inesperados de Firestore, por ejemplo) tumbaba toda la app a pantalla en
// blanco, sin ningún mensaje. Esto aísla el fallo y deja recuperarse sin
// perder la sesión.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en la interfaz:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-8 text-center gap-4">
          <div className="w-16 h-16 bg-error/10 rounded-3xl flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-error" />
          </div>
          <h1 className="text-xl font-black text-on-surface">Algo salió mal</h1>
          <p className="text-sm text-on-surface-variant max-w-xs">
            Esta pantalla encontró un error inesperado. Tus datos están a salvo — puedes intentar recargar.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 active:scale-95 transition-all"
          >
            <RefreshCcw className="w-4 h-4" />
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
