import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import { auth } from '../firebaseAuth';

/**
 * Cuentas que pueden entrar al CRM. Tiene que coincidir con la lista de
 * firestore.rules (función isOwner): si agregás una cuenta, sumala en los dos lados.
 */
export const ALLOWED_EMAILS = ['puntocerovision@gmail.com', 'liendojuan070@gmail.com'];

export function isAllowedUser(user: User | null): boolean {
  return Boolean(user?.email && user.emailVerified && ALLOWED_EMAILS.includes(user.email.toLowerCase()));
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (err: any) {
    // En la app instalada (PWA) o con bloqueador de ventanas, el popup falla: usamos redirección
    if (err?.code === 'auth/popup-blocked' || err?.code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw err;
  }
}

export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

// Encabezado para las rutas /api/ai del servidor: sin sesión válida no se usa la cuota de Gemini
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
