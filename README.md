# Chute Mundo

Aplicación personal para administrar los torneos de Chute Mundo: equipos, plantillas, ligas, copas, amistosos, resultados, estadísticas, clásicos, rankings y respaldos.

> Proyecto distinto de **Chute PC** (videojuego de cartas/cancha) y de **Torneos Chute** (plataforma general publicada en `torneos-chute.vercel.app`).

## Versión actual

**v1.4.0 — Estadísticas completas y creación mejorada de torneos**

Esta versión amplía la página de Estadísticas con un resumen general, una tabla de todos los torneos y el rendimiento de los participantes. También mejora el flujo para crear torneos nuevos, abrirlos inmediatamente y sincronizar el respaldo con Supabase cuando la conexión está habilitada.

Para publicar cambios con doble clic utiliza [`Subir_Chute_Mundo_a_GitHub.bat`](Subir_Chute_Mundo_a_GitHub.bat). Consulta las instrucciones en [`USO_PUBLICADOR_GITHUB.md`](USO_PUBLICADOR_GITHUB.md).

## Funcionalidades disponibles

- Registro y edición de equipos, escudos y plantillas.
- Torneos de Liga, Liga + Playoff, Copa con grupos, Eliminación directa y División con final.
- Creación de torneos nuevos y generación del torneo siguiente a partir del último.
- Fase regular de ida o ida/vuelta cuando el formato lo permite.
- Registro de resultados, penales, goles, asistencias, tarjetas y sedes.
- Tabla de posiciones, fases de grupo, semifinales, tercer lugar y final.
- Historial de torneos, palmarés, rendimiento, ranking FIFA, clásicos y disciplina.
- Resumen estadístico global por era.
- Tabla completa de torneos con avance, partidos, goles, equipos y campeón.
- Estadísticas de participantes y enfrentamientos directos.
- Partidos amistosos y estadísticas globales.
- Modo oscuro.
- Exportación e importación de respaldos JSON.
- Preparación opcional para sincronizar un respaldo completo en Supabase.

## Abrir localmente

Puedes abrir `index.html` directamente en el navegador. Para una prueba más parecida a producción, ejecuta un servidor local:

```bash
npm run dev
```

Luego abre la dirección indicada por la terminal.

También está disponible `Iniciar_Chutemundo.bat` para Windows.

## Crear un torneo

1. Ve a **Torneos**.
2. Presiona **+ Nuevo torneo** o completa directamente el formulario.
3. Ingresa un nombre único.
4. Elige el formato, la fase regular y el estado.
5. Marca los equipos participantes.
6. Presiona **Crear y abrir torneo**.

El sistema genera automáticamente los partidos correspondientes y abre el torneo recién creado.

También puedes usar **Crear siguiente** para repetir los equipos y la configuración del último torneo con un nombre nuevo.

Reglas mínimas:

- **Copa con grupos:** 4 equipos.
- **Liga + Playoff:** 4 equipos.
- **Eliminación directa:** 2 a 8 equipos.
- **Liga y División con final:** 2 equipos o más.

## Estadísticas

La sección **Estadísticas** incluye:

- resumen de equipos, jugadores, torneos, partidos, goles y tarjetas;
- máximo goleador y máximo asistidor;
- líder histórico por puntos;
- listado completo de torneos con porcentaje de avance;
- tabla general acumulada;
- palmarés y títulos por categoría;
- ranking de rendimiento y ranking estilo FIFA;
- clásicos y Head To Head;
- goleadores y asistencias;
- sanciones y tarjetas;
- rendimiento de participantes.

Los indicadores pueden filtrarse por Toda la Historia, Era Clásica o Era Divisiones.

## Guardado y respaldos

La fuente principal de datos sigue siendo el navegador, mediante `localStorage`.

En **Admin > Respaldos** puedes:

- exportar el estado completo a JSON;
- importar un respaldo previo;
- restaurar la base inicial desde las opciones administrativas.

Antes de actualizar una publicación o cambiar de computador, exporta un respaldo JSON.

## Supabase

La app incluye una integración opcional de Supabase para almacenar un respaldo completo del estado. Cuando Supabase está conectado, los torneos creados con el flujo mejorado solicitan además una sincronización en la nube.

No constituye aún una solución multiusuario completa: faltan autenticación, perfiles y políticas RLS de producción.

Documentación relacionada:

- [`docs/SUPABASE.md`](docs/SUPABASE.md)
- [`supabase/schema.sql`](supabase/schema.sql)
- [`supabase/schema_demo_no_publicar.sql`](supabase/schema_demo_no_publicar.sql)

## Publicación en Vercel

El proyecto incluye `vercel.json` y puede desplegarse como sitio estático. Revisa [`docs/VERCEL.md`](docs/VERCEL.md) antes de publicar.

## Validaciones de esta entrega

- Sintaxis JavaScript validada para `chutemundo-enhancements.js` y `supabaseClient.js`.
- Compatibilidad mantenida con el estado y los respaldos existentes.
- El flujo mejorado utiliza los mismos generadores de partidos de la aplicación principal.
- No se eliminan ni modifican torneos existentes durante la actualización.

## Historial de versiones

- **v1.4.0:** estadísticas completas visibles, tabla de todos los torneos, rendimiento de participantes y creación mejorada de nuevas competencias.
- **v1.3.1:** incorporado `Subir_Chute_Mundo_a_GitHub.bat` y guía de uso para publicación por GitHub.
- [`CAMBIOS_v1.3.md`](CAMBIOS_v1.3.md): copas corregidas, equipos participantes visibles y compatibilidad de datos.
- [`CAMBIOS_v1.2.md`](CAMBIOS_v1.2.md): preparación cloud con Supabase/Vercel.
- [`CAMBIOS_v1.1.md`](CAMBIOS_v1.1.md): estabilización inicial.
