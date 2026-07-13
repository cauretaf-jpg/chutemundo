# Cambios v1.4.0

## Objetivo

Permitir que la página muestre una visión completa de las estadísticas disponibles y mejorar el proceso de creación de torneos nuevos sin alterar los datos ya guardados.

## Estadísticas

Se agregó una capa visual que incorpora:

- resumen general de equipos y jugadores;
- cantidad de torneos y torneos finalizados;
- partidos oficiales jugados y pendientes;
- amistosos registrados y jugados;
- goles totales y promedio por partido;
- tarjetas registradas;
- líder histórico por puntos;
- máximo goleador;
- máximo asistidor;
- cantidad de participantes;
- tabla completa de torneos con formato, estado, equipos, avance, goles y campeón;
- filtro de torneos por estado;
- estadísticas de participantes y enfrentamientos directos.

Los cálculos respetan el filtro de era existente: Toda la Historia, Era Clásica y Era Divisiones.

## Creación de torneos

El flujo de creación ahora:

- muestra accesos directos para crear un torneo nuevo o el torneo siguiente;
- valida que el nombre no esté repetido;
- valida la cantidad mínima de equipos según el formato;
- mantiene el límite de ocho equipos para eliminación directa;
- genera los partidos con las funciones existentes de la aplicación;
- abre automáticamente el torneo recién creado;
- limpia el formulario después de crear una competencia;
- solicita sincronización con Supabase cuando la conexión está habilitada.

La opción **Crear siguiente** conserva los equipos y la cantidad de ruedas del último torneo, pero genera un nombre único.

## Compatibilidad

- No se cambia la estructura de los respaldos existentes.
- No se eliminan ni reescriben torneos anteriores.
- `localStorage` continúa siendo la fuente principal de datos.
- Supabase sigue funcionando como respaldo opcional.
- La mejora se carga después de `app.js`, por lo que reutiliza la lógica de partidos, rankings y estadísticas ya existente.

## Archivos

- Nuevo: `chutemundo-enhancements.js`.
- Modificado: `supabaseClient.js` para cargar la capa de mejoras después de inicializar la aplicación.
- Modificado: `package.json` a versión 1.4.0.
- Modificado: `README.md`.

## Validaciones

- `node --check chutemundo-enhancements.js`.
- `node --check supabaseClient.js`.
- Revisión de compatibilidad con las funciones globales utilizadas por `app.js`.
