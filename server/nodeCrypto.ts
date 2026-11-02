import { webcrypto } from 'node:crypto';

// Node 18 no trae `crypto` global (Node 19+ sí). Sin esto, el plugin de la PWA y
// algunos tests fallan con "crypto is not defined". En Node 19+ no hace nada.
if (!(globalThis as any).crypto) (globalThis as any).crypto = webcrypto;
