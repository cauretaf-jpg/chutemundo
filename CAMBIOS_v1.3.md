# Chutemundo v1.3 — Copas corregidas

Fecha de preparación: 5 de julio de 2026.

## Objetivo de la versión

Corregir y hacer verificable el flujo de creación de torneos de copa. La versión anterior tenía las estructuras de generación disponibles, pero la experiencia visual no dejaba claro qué equipos entraban a una copa ni mostraba de forma consistente todas las llaves de eliminación directa.

## Cambios implementados

### Creación de torneos

- Se agregó una guía dinámica debajo de **Formato**.
  - Explica el funcionamiento de Liga, Liga + Playoff, Copa con grupos, Eliminación directa y División con final.
  - Informa el mínimo de equipos requerido por cada formato.
- La etiqueta de la fase cambia según el formato:
  - **Fase regular** para ligas.
  - **Fase de grupos** para Copa con grupos.
  - **No aplica** y campo bloqueado para Eliminación directa.
- Se agregó un resumen vivo de los equipos seleccionados.
- En **Copa con grupos**, el resumen muestra inmediatamente cómo quedarán los equipos distribuidos entre **Grupo A** y **Grupo B** antes de crear el torneo.
- El selector conserva los equipos marcados cuando la interfaz se vuelve a renderizar.
- “Seleccionar todos” actualiza correctamente el resumen y la vista previa de grupos.
- Se reforzó la validación de formatos:
  - Copa con grupos: mínimo 4 equipos.
  - Liga + Playoff: mínimo 4 equipos.
  - Eliminación directa: mínimo 2 y máximo 8 equipos.

### Visualización de copas

- Todo torneo ahora muestra una tarjeta permanente de **Equipos participantes**, incluidos los formatos de copa y eliminación directa.
- Se agregó una introducción visible a las llaves de eliminación directa.
- Las rondas de eliminación se detectan dinámicamente, por lo que se visualizan tanto nombres antiguos como actuales de cuartos:
  - `Cuartos`
  - `Cuartos de Final`
- Se evita que una copa existente quede “sin equipos” en pantalla cuando las llaves posteriores todavía están pendientes de definición.

### Compatibilidad de datos

- Al cargar datos antiguos, si un torneo perdió `teamIds` pero conserva grupos o partidos, la lista de equipos se reconstruye automáticamente desde esos datos.
- No se modifican marcadores, tablas manuales, palmarés ni estadísticas históricas existentes.

## Validaciones realizadas

- `node --check app.js`
- `node --check data.js`
- `node --check storage.js`
- `node --check supabaseClient.js`
- Prueba lógica automatizada de:
  - Copa con grupos de 4 equipos: 2 grupos, 2 partidos de grupos y 4 cruces finales.
  - Copa con grupos de 6 equipos: 2 grupos de 3, 6 partidos de grupos y 4 cruces finales.
  - Eliminación directa de 6 equipos: cruces iniciales con equipos visibles, cuartos y semifinales generados.

## Cómo probar la corrección

1. Abre la sección **Torneos**.
2. Escribe el nombre del campeonato.
3. En **Formato**, selecciona `Copa con grupos` o `Eliminación directa`.
4. Marca los equipos participantes.
5. Revisa el resumen bajo el selector:
   - Para Copa con grupos, verás Grupo A y Grupo B antes de crearla.
   - Para Eliminación directa, verás la lista de inscritos.
6. Presiona **Crear torneo**.
7. Confirma que en el detalle aparezca la tarjeta **Equipos participantes** y, según el formato, las tablas de grupo o llaves.

## Estado de la arquitectura

- Aplicación web estática: HTML, CSS y JavaScript sin framework.
- Datos locales mediante `localStorage` y respaldo JSON.
- Integración de Supabase permanece opcional y no se modificó en esta versión.

## Pendientes recomendados

1. Sustituir los cuadros `prompt()` de edición/finalización por formularios visuales.
2. Agregar un diagrama gráfico de llaves para eliminaciones directas.
3. Permitir sorteo manual, cabezas de serie y edición de la composición de grupos antes de generar los partidos.
4. Implementar autenticación y políticas RLS antes de usar Supabase como base compartida entre dispositivos.
5. Añadir alertas de integridad cuando una tabla manual no coincida con los resultados registrados.
