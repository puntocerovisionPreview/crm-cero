import React, { useState } from 'react';
import { AlertCircle, Loader2, LogOut } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { ALLOWED_EMAILS, signInWithGoogle, signOutUser } from '../utils/authAccess';

interface Props {
  // Si hay sesión con una cuenta que no está autorizada, se muestra ese correo
  deniedEmail?: string | null;
}

// Entrada al CRM con Google. Solo las cuentas de ALLOWED_EMAILS pueden ver los datos
// (las reglas de Firestore lo exigen también del lado del servidor).
export const AuthScreen: React.FC<Props> = ({ deniedEmail }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        // El usuario cerró la ventana: no es un error
      } else if (err?.code === 'auth/unauthorized-domain') {
        setError('Este dominio no está autorizado en Firebase. Abrí la app desde su dirección publicada.');
      } else if (err?.code === 'auth/network-request-failed') {
        setError('Sin conexión. Revisá internet y probá de nuevo.');
      } else {
        setError('No se pudo iniciar sesión con Google. Probá de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-center items-center px-4 py-8">
      <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[var(--radius-card)] p-7 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <BrandLogo size="lg" />
          <h1 className="text-2xl font-bold">Entrá a .Cero CRM</h1>
          <p className="text-sm text-[var(--text-secondary)]">Usá tu cuenta de Google autorizada.</p>
        </div>

        {deniedEmail && (
          <div className="p-3 rounded-[var(--radius-control)] bg-red-500/10 border border-red-500/30 text-sm text-red-400 space-y-2">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {deniedEmail} no tiene acceso. Entrá con {ALLOWED_EMAILS.join(' o ')}.
              </span>
            </div>
            <button
              type="button"
              onClick={() => signOutUser()}
              className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] hover:underline"
            >
              <LogOut className="w-3.5 h-3.5" />
              Cerrar esa sesión
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-[var(--radius-control)] bg-red-500/10 border border-red-500/30 text-sm text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="w-full py-3 rounded-[var(--radius-control)] bg-[var(--accent)] hover:bg-[var(--accent-strong)] text-[var(--on-accent)] font-semibold text-sm flex items-center justify-center gap-2 transition disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
                <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.7 14.55 2.75 12 2.75 6.92 2.75 2.8 6.9 2.8 12s4.12 9.25 9.2 9.25c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.16Z" />
              </svg>
              <span>Entrar con Google</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
