import { getAuth, setPersistence, browserLocalPersistence, Auth } from 'firebase/auth';
import app from './firebase';

// Login con Google (solo lo usa el CRM; el portal del alumno no lo necesita)
export const auth: Auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn('Could not set browserLocalPersistence for auth:', err);
});
