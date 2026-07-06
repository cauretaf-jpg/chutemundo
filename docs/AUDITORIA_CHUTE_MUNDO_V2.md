# Auditoría técnica — Chute Mundo v2

Fecha: 2026-07-06

## Hallazgos corregidos

1. **Despliegue en Vercel**
   - El proyecto exige un directorio de salida `public`.
   - Se mantuvo la publicación como aplicación estática, compatible con el `build` actual que no genera artefactos adicionales.

2. **Pantalla Firebase anterior**
   - Había una implementación con estilos acumulados y una dependencia incorrecta de un selector de equipos.
   - El fallo `Cannot read properties of null (reading 'length')` detenía el renderizado completo antes de dibujar métricas y paneles.
   - Se retiraron los archivos obsoletos `cloud-app.mjs`, `cloud.css` y `cloud-fix.css`.

3. **Base estable Firebase**
   - Ruta funcional: `cloud.html`, que redirige a `cloud-stable.html`.
   - Archivos activos:
     - `public/cloud-stable.html`
     - `public/cloud-stable.css`
     - `public/cloud-stable.mjs`
   - No se parchea `document.querySelector` ni se depende de selectores que puedan devolver `null`.

4. **Estado y sincronización**
   - Estado local de contingencia en `localStorage`.
   - Documento compartido Firestore: `chuteMundo/sharedState`.
   - Guardado con retraso breve para evitar múltiples escrituras consecutivas.
   - Sesión persistente con Firebase Authentication.

5. **Permisos**
   - El frontend reconoce como administrador solo a `cauretaf@gmail.com`.
   - Las reglas disponibles en `firestore.rules` limitan escritura a ese correo.
   - Lectura pública se mantiene para permitir consulta de resultados cuando la base sea activada.

6. **Motor de competición revisado**
   - Liga, copa con dos grupos y eliminación directa de hasta ocho equipos.
   - Clasificación de grupos, semifinales, tercer lugar y final.
   - Pases directos en llave eliminatoria.
   - Penales obligatorios para empates en fases eliminatorias.
   - Tabla y ranking calculados desde los resultados, no editados de forma manual.

## Validaciones realizadas

- Sintaxis del módulo estable validada con `node --check`.
- Revisión de referencias de DOM: todas las lecturas de elementos potencialmente ausentes se protegen antes de usarse.
- Revisión de configuración de Vercel: la app se mantiene como sitio estático con salida `public`.

## Estado de publicación

La versión Firebase estable todavía se prueba en la ruta separada. La raíz del sitio no debe reemplazarse hasta comprobar:

1. Carga visual correcta.
2. Inicio de sesión correcto.
3. Publicación de reglas Firestore.
4. Activación de `chuteMundo/sharedState`.
5. Creación de una copa de prueba con seis equipos.
