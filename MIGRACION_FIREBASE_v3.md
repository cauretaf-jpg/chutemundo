# Chute Mundo v3.0.0 — Historial oficial y Firebase

## Objetivo

Unificar la aplicación pública, el historial de torneos y la base compartida de Firebase. La página principal deja de depender de una base local vacía y recupera directamente la información histórica incluida en `data.js`.

## Fuente histórica

El archivo `data.js` conserva la estructura completa utilizada por Chute Mundo:

- equipos y planteles;
- participantes;
- clásicos;
- torneos históricos y activo;
- partidos, marcadores y penales;
- tablas manuales históricas;
- campeones, subcampeones y terceros;
- goleadores y asistencias;
- notas y lugares de juego.

La versión oficial normaliza esos datos sin eliminar campos del modelo anterior.

## Funcionamiento de la migración

1. Al abrir la página, se carga y normaliza el historial de `data.js`.
2. La aplicación consulta el documento `chuteMundo/sharedState` en Firestore.
3. Solo se utiliza el estado remoto si contiene, como mínimo, todos los torneos y resultados del historial original.
4. Si Firebase está vacío o incompleto, el historial original se muestra inmediatamente como respaldo seguro.
5. Cuando el administrador inicia sesión, el historial se guarda automáticamente en Firestore.
6. Desde ese momento, los nuevos torneos y resultados se sincronizan entre dispositivos.

## Seguridad y control

- La consulta del historial es pública según las reglas actuales de Firestore.
- Solo la cuenta administradora configurada en la aplicación puede escribir.
- No se incluyen contraseñas ni claves privadas en el repositorio.
- La configuración pública de Firebase se reutiliza desde la implementación existente.

## Funciones de la versión oficial

- historial completo de torneos;
- torneo activo y partidos pendientes;
- creación de ligas, ligas con playoff, copas con grupos, eliminación directa y divisiones con final;
- edición de resultados y penales;
- tabla histórica acumulada;
- palmarés;
- resumen por torneo;
- goleadores y asistencias;
- clásicos;
- estadísticas de participantes;
- récords históricos;
- exportación e importación JSON;
- restauración del historial original.

## Publicación

`vercel.json` reescribe la raíz `/` hacia `public/chute-official.html`, por lo que la dirección oficial continúa siendo:

`https://chutemundo.vercel.app`

## Validaciones

- El runtime completo fue reconstruido desde sus seis partes y validado con `node --check`.
- La estructura histórica se mantiene en `data.js` como respaldo reproducible.
- Una base remota incompleta no puede reemplazar silenciosamente el historial original.
- La migración a Firestore se ejecuta únicamente con sesión administradora.

## Paso único del administrador

Después de publicar la versión, iniciar sesión una vez desde la página. Si Firebase aún no contiene el historial completo, la migración se ejecutará automáticamente. También estará disponible el botón **Restaurar historial oficial** en Administración.
