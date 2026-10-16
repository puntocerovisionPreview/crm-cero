import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { BrandLogo } from './BrandLogo';
import { Lock, Mail, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  onSuccess: () => void;
}

export const AuthScreen: React.FC<Props> = ({ onSuccess }) => {
  const [email, setEmail] = useState('puntocerovision@gmail.com');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Por favor completá tu correo y contraseña.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      onSuccess();
    } catch (err: any) {
      console.error('Firebase Auth error:', err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError('Contraseña o correo incorrectos.');
      } else if (err.code === 'auth/user-not-found') {
        setError('No existe una cuenta con este correo. Podés crearla debajo.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('Este correo ya está registrado. Intentá iniciar sesión.');
      } else if (err.code === 'auth/weak-password') {
        setError('La contraseña debe tener al menos 6 caracteres.');
      } else {
        setError(err.message || 'Error al autenticar.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError('Ingresá tu correo para recuperar la contraseña.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err: any) {
      setError(err.message || 'Error al enviar correo de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0F17] text-[#E8ECF4] flex flex-col justify-center items-center px-4 py-8 select-none">
      <div className="w-full max-w-sm bg-[#121826] border border-[#263047] rounded-2xl p-7 shadow-2xl space-y-6">
        <div className="flex flex-col items-center text-center space-y-2">
          <BrandLogo size="lg" className="mb-2" />
          <h1 className="text-xl font-bold tracking-tight text-[#E8ECF4]">
            {isRegistering ? 'Crear acceso operador' : 'Acceso .Cero CRM'}
          </h1>
          <p className="text-xs text-[#8B95A9]">
            Autenticación segura vinculada a tu cuenta de Firestore
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {resetSent && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 text-center">
            Se envió un correo a {email} para restablecer la contraseña.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#8B95A9] mb-1.5">
              Correo electrónico
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#8B95A9] absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operador@puntocero.com"
                className="w-full bg-[#1A2233] border border-[#263047] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E8ECF4] placeholder-[#8B95A9]/50 focus:outline-none focus:border-[#4C8DFF]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#8B95A9] mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#8B95A9] absolute left-3 top-3" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#1A2233] border border-[#263047] rounded-xl pl-9 pr-3 py-2.5 text-sm text-[#E8ECF4] placeholder-[#8B95A9]/50 focus:outline-none focus:border-[#4C8DFF]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#4C8DFF] hover:bg-[#3B7BF0] text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#4C8DFF]/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>{isRegistering ? 'Registrar operador' : 'Iniciar sesión'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="pt-2 flex flex-col items-center gap-2 text-xs text-[#8B95A9]">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="hover:text-[#E8ECF4] transition-colors"
          >
            {isRegistering
              ? '¿Ya tenés cuenta? Iniciar sesión'
              : '¿Primera vez? Crear contraseña para este correo'}
          </button>

          {!isRegistering && (
            <button
              type="button"
              onClick={handleResetPassword}
              className="text-[#8B95A9]/70 hover:text-[#8B95A9] underline text-[11px]"
            >
              ¿Olvidaste tu contraseña?
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
