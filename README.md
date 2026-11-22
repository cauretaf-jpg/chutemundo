# ChuteMundo

ChuteMundo es la plataforma deportiva del universo Chute. Gestiona torneos, partidos, equipos, jugadores, divisiones, estadísticas, disciplina, clásicos, rankings y archivo histórico.

## Versión actual

**ChuteMundo 6.2.1 — navegación inmersiva**

La versión 6.2 implementa el prototipo visual aprobado: Inicio único, catálogo de torneos, centro de torneo, calendario y centro de partido, clubes, jugadores, explorador estadístico, disciplina y administración, tanto en móvil como en escritorio. Todas las vistas deportivas usan datos existentes de Firebase y conservan un recorrido contextual. Se mantiene la modularización 6.1.

## Arquitectura

```text
public/
  app.mjs
  modules/
    admin/
    assets/
    auth/
    core/
    data/
    detail/
    discipline/
    matches/
    statistics/
    tournaments/
    ui/
  styles/
    experience.css
  modules/ui/
    experience.mjs
    experience-views.mjs
```

Reglas de arquitectura:

- Firebase es la fuente oficial compartida.
- `localStorage` es caché y recuperación, no fuente de verdad.
- JSON se usa para respaldo y migraciones controladas.
- No se permiten archivos `.txt` dentro del runtime.
- No se permiten rutas activas `/chute-v*`.
- Las nuevas funciones deben incorporarse al dominio correspondiente, no como parches versionados.

## Navegación

- **Inicio:** torneo activo, progreso, próximo partido, últimos resultados y líderes.
- **Torneos:** competencias activas, próximas e históricas.
- **Partidos:** calendario, alineaciones, eventos y centro de partido.
- **Equipos:** clubes, planteles y perfiles.
- **Jugadores:** fichas y rendimiento individual.
- **Estadísticas:** archivo histórico, FIFA/ELO, palmarés, récords y enfrentamientos.
- **Disciplina:** tarjetas y sanciones.
- **Administración:** integridad, respaldos, Firebase y mantenimiento.

## Datos y seguridad

Firestore mantiene lectura pública del archivo deportivo y escritura administrativa.

La autorización ya reconoce custom claims:

- `admin: true`
- `role: "admin"`

Se mantiene temporalmente el acceso histórico de compatibilidad hasta configurar el claim definitivo. La trazabilidad pública deja de registrar el correo del administrador y utiliza una identidad genérica.

Existe un respaldo Git previo a esta versión:

`backup/pre-6.1-2026-11-22`

## Rankings

### Ranking FIFA/ELO
Mide fuerza competitiva actual.

### Ranking histórico
Mide legado y ordena por:

1. títulos;
2. puntos históricos;
3. diferencia de gol;
4. goles a favor.

### Tabla histórica
Acumula rendimiento puro de partidos oficiales.

Los tres indicadores son deliberadamente distintos.

## Partidos

Los marcadores soportan dos modos:

- `events`: el resultado se deriva de los goles estructurados.
- `manual`: conserva resultados históricos o casos sin detalle completo de eventos.

## Identidad de jugadores

El esquema `player-ids-v1` asigna IDs persistentes y conserva alias históricos. Goles, asistencias, tarjetas y sustituciones pueden referenciar jugadores por ID para evitar que una corrección de nombre rompa estadísticas.

## Assets

Las fotografías y escudos de producción se almacenan normalizados dentro de `public/assets/`. Los originales se conservan fuera del runtime público.

## Desarrollo

```bash
npm install
npm run dev
```

Validaciones:

```bash
npm run audit
npm run check:data
npm run smoke
npm run smoke:responsive
npm run smoke:experience
```

La navegación pública utiliza enlaces profundos con hash para ser compatible con el hosting estático (por ejemplo `/#/torneos/{id}`, `/#/partidos/{torneoId}/{partidoId}` y `/#/jugadores/{clubId}/{nombre}`). Las pestañas locales y el botón Atrás conservan el recorrido. Los enlaces pueden compartirse directamente.

Las herramientas administrativas originales siguen disponibles desde Administración → «Abrir herramientas de administración», que activa `?classic=1`. Este modo mantiene los formularios de Firebase, torneos, respaldos y centro de partido sin modificar sus operaciones.

CI valida:

- arquitectura y sintaxis;
- ausencia de fragmentos `.txt`;
- ausencia de rutas legacy;
- integridad del fallback deportivo;
- smoke test funcional;
- responsive en 360×800, 390×844, 412×915, 768×1024 y 1440×900;
- recursos JS/CSS rotos;
- pantallas públicas 6.2 y rutas profundas en 5 resoluciones;
- regreso contextual y compatibilidad de las herramientas clásicas;
- empaquetado de producción.

## Despliegue

ChuteMundo se publica como sitio estático mediante Vercel y GitHub.

- HTML, JS y CSS se revalidan para evitar mezclas de caché entre versiones.
- imágenes y fuentes usan caché larga.
- ramas técnicas no se despliegan automáticamente.
- `main` es la rama de producción.

## Chute y ChuteMundo

Son productos relacionados pero distintos:

- **Chute:** juego de fútbol/cartas.
- **ChuteMundo:** competición, archivo histórico y estadísticas.

En Chute hay **45 cartas que participan en el juego de fútbol**. El **DT es adicional** y no forma parte de esas 45 cartas.
