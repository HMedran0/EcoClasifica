import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// El build de producción ya falla sin ellas (vite.config.ts); esto cubre `npm run dev`.
if (!url || !publishableKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver frontend/.env.example)');
}

/** Solo Auth en el navegador: los datos de usuario se leen a través del backend. */
export const supabase = createClient(url, publishableKey, {
  // PKCE: el regreso de Google y del correo de verificación trae `?code=` y no tokens en el hash.
  auth: { flowType: 'pkce' },
});
