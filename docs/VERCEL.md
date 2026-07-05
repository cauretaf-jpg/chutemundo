# Vercel - Chutemundo v1.2

Esta app sigue siendo estática. Puedes desplegarla en Vercel desde la raíz del proyecto.

## Estructura esperada

- `index.html`
- `styles.css`
- `data.js`
- `storage.js`
- `supabaseClient.js`
- `app.js`
- carpetas de imágenes: `logo`, `escudos`, `cartas`

## Configuración simple en Vercel

- Framework preset: Other
- Root directory: raíz del proyecto
- Build command: vacío o `npm run build`
- Output directory: vacío

## Variables de entorno

Esta versión todavía no usa variables de entorno de Vercel porque es una app estática sin build.
La configuración de Supabase se ingresa desde la pantalla Admin y queda guardada localmente en el navegador.

En una versión futura con Vite/React, se podrían usar:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
