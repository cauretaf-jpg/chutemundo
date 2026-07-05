# Chute Mundo

Aplicación personal para administrar los torneos de Chute Mundo: equipos, plantillas, ligas, copas, amistosos, resultados, estadísticas, clásicos, rankings y respaldos.

> Proyecto distinto de **Chute PC** (videojuego de cartas/cancha) y de **Torneos Chute** (plataforma general publicada en `torneos-chute.vercel.app`).

## Versión actual

**v1.3.1 — Publicador GitHub incluido**

La versión actual conserva la corrección del flujo de copas e incorpora un publicador automático para GitHub. Al elegir Copa con grupos o Eliminación directa, la aplicación muestra los equipos inscritos y, en las copas con grupos, una vista previa de Grupo A y Grupo B antes de crear el torneo.

Para publicar cambios con doble clic utiliza [`Subir_Chute_Mundo_a_GitHub.bat`](Subir_Chute_Mundo_a_GitHub.bat). Consulta las instrucciones en [`USO_PUBLICADOR_GITHUB.md`](USO_PUBLICADOR_GITHUB.md).

## Funcionalidades disponibles

- Registro y edición de equipos, escudos y plantillas.
- Torneos de Liga, Liga + Playoff, Copa con grupos, Eliminación directa y División con final.
- Fase regular de ida o ida/vuelta cuando el formato lo permite.
- Registro de resultados, penales, goles, asistencias, tarjetas y sedes.
- Tabla de posiciones, fases de grupo, semifinales, tercer lugar y final.
- Historial de torneos, palmarés, rendimiento, ranking FIFA, clásicos y disciplina.
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

## Publicar en GitHub

Después de copiar esta versión sobre tu carpeta local original del proyecto, ejecuta `Subir_Chute_Mundo_a_GitHub.bat`. El script revisa los cambios, solicita un mensaje de commit y hace el `git push` automáticamente.

No lo ejecutes desde una carpeta extraída sin `.git`; consulta [`USO_PUBLICADOR_GITHUB.md`](USO_PUBLICADOR_GITHUB.md).

## Crear una copa correctamente

1. Ve a **Torneos**.
2. Ingresa el nombre.
3. Elige `Copa con grupos` o `Eliminación directa` en **Formato**.
4. Marca los equipos.
5. Revisa el bloque bajo el selector:
   - En Copa con grupos, se muestra la distribución automática de los equipos entre Grupo A y Grupo B.
   - En Eliminación directa, se muestra el total y los equipos inscritos.
6. Crea el torneo.

Reglas mínimas:

- **Copa con grupos:** 4 equipos.
- **Liga + Playoff:** 4 equipos.
- **Eliminación directa:** 2 a 8 equipos.
- **Liga y División con final:** 2 equipos o más.

## Guardado y respaldos

La fuente principal de datos sigue siendo el navegador, mediante `localStorage`.

En **Admin > Respaldos** puedes:

- exportar el estado completo a JSON;
- importar un respaldo previo;
- restaurar la base inicial desde las opciones administrativas.

Antes de actualizar una publicación o cambiar de computador, exporta un respaldo JSON.

## Supabase

La app incluye una integración opcional de Supabase para almacenar un respaldo completo del estado. No constituye aún una solución multiusuario completa: faltan autenticación, perfiles y políticas RLS de producción.

Documentación relacionada:

- [`docs/SUPABASE.md`](docs/SUPABASE.md)
- [`supabase/schema.sql`](supabase/schema.sql)
- [`supabase/schema_demo_no_publicar.sql`](supabase/schema_demo_no_publicar.sql)

## Publicación en Vercel

El proyecto incluye `vercel.json` y puede desplegarse como sitio estático. Revisa [`docs/VERCEL.md`](docs/VERCEL.md) antes de publicar.

## Validaciones de esta entrega

- Sintaxis JavaScript validada para `app.js`, `data.js`, `storage.js` y `supabaseClient.js`.
- Lógica de copas validada para 4 y 6 equipos.
- Lógica de eliminación directa validada para 6 equipos.
- Detalle reproducible en [`VALIDACION_v1.3.md`](VALIDACION_v1.3.md).

## Historial de versiones

- **v1.3.1:** incorporado `Subir_Chute_Mundo_a_GitHub.bat` y guía de uso para publicación por GitHub.
- [`CAMBIOS_v1.3.md`](CAMBIOS_v1.3.md): copas corregidas, equipos participantes visibles y compatibilidad de datos.
- [`CAMBIOS_v1.2.md`](CAMBIOS_v1.2.md): preparación cloud con Supabase/Vercel.
- [`CAMBIOS_v1.1.md`](CAMBIOS_v1.1.md): estabilización inicial.
