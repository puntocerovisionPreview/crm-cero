import { defineConfig } from 'vitest/config';

// Pruebas de la lógica crítica (cobros, saldos, fechas, rutina, mensajes).
// Se corren con: npm test
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    env: { TZ: 'America/Argentina/Cordoba' },
  },
});
