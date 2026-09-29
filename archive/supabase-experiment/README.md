# Experimento Supabase archivado

ChuteMundo 6 adopta **Firebase como única fuente oficial de datos**.

La integración experimental de Supabase usada en las versiones 1.x se retiró del runtime y del árbol activo para evitar dos fuentes de verdad. Su implementación completa permanece recuperable en el historial Git anterior a ChuteMundo 6, especialmente en el respaldo `backup/pre-v6-2026-09-29`.

Modelo vigente:

- Firebase: datos oficiales compartidos.
- localStorage: caché y recuperación local.
- JSON: respaldo portable.
