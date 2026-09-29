# Legado anterior a ChuteMundo 6

La aplicación activa vive íntegramente en `public/`.

Los entrypoints y prototipos antiguos de la raíz (v1/v2), documentación de migraciones tempranas y experimentos previos se retiraron del árbol activo durante la consolidación de ChuteMundo 6.

Nada se perdió: el estado previo completo está preservado en:

- rama `backup/pre-v6-2026-09-29`
- commit base `3440f66cc07d003fd08a7419e2abe6adc4666aad`
- historial normal de Git

El historial deportivo que aún se necesita para recuperación fue convertido a `public/official-history.json`, por lo que la aplicación ya no depende de `data.js` remoto.
