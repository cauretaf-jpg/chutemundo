# Chute Mundo

ChuteMundo es la plataforma deportiva del universo **Chute**. Administra torneos, partidos, equipos, jugadores, divisiones, estadísticas, clásicos, disciplina y rankings históricos.

## Versión actual

**Chute Mundo 6.0.0 — consolidación**

La versión 6 mantiene compatibilidad con el historial existente y consolida la aplicación alrededor de una sola fuente oficial de datos, una versión canónica, una navegación móvil y una lectura estadística más clara.

### Cambios principales

- Firebase queda definido como **fuente oficial**.
- `localStorage` queda como caché y recuperación local.
- JSON queda como respaldo portable.
- Supabase se retira del runtime activo y queda documentado como experimento archivado.
- Se separan **Ranking FIFA/ELO**, **Ranking histórico** y **Tabla histórica**.
- Nuevo dashboard con próximo partido, últimos resultados y jugador de mayor contribución.
- Perfiles ampliados de jugadores.
- Navegación móvil inferior.
- Fotografías normalizadas visualmente mediante un contenedor común.
- Formulario de torneos con configuración avanzada plegable.
- Marcadores nuevos distinguen entre modo manual y modo derivado de eventos.
- El acceso administrador queda preparado para claims/roles de Firebase, conservando temporalmente compatibilidad con la cuenta administradora histórica.
- La PWA usa una caché de shell más pequeña y caché runtime para módulos y activos.
- CI principal consolidado en `audit-v6` y `smoke-v6`.

## Navegación

- **Inicio:** estado actual de la competición.
- **Torneos:** competencias activas, futuras e históricas.
- **Partidos:** calendario y centro de partido.
- **Equipos:** clubes y planteles.
- **Jugadores:** fichas individuales y rendimiento.
- **Estadísticas:** FIFA/ELO, ranking histórico, tabla histórica, palmarés, goleadores, asistencias, clásicos y récords.
- **Disciplina:** tarjetas y sanciones.
- **Administración:** Firebase, respaldos, integridad, reglamento y mantenimiento.

## Modelo de datos

### Firebase
Fuente de verdad compartida para equipos, torneos, partidos, eventos, participantes y estadísticas.

### Almacenamiento local
Caché de recuperación. No debe considerarse la fuente oficial cuando Firebase está disponible.

### JSON
Formato de respaldo y migración portable.

Antes de una modificación estructural importante se recomienda conservar un respaldo JSON y una referencia Git estable.

## Rankings

### Ranking FIFA Chute
Modelo ELO propio. Considera resultado, fuerza del rival, fase, diferencia de gol, definición por penales, amistosos con peso reducido y bonos de podio.

### Ranking histórico
Mide legado. Ordena por:

1. títulos;
2. puntos históricos;
3. diferencia de gol;
4. goles a favor.

### Tabla histórica
Acumulación deportiva pura de los partidos oficiales.

Los tres indicadores responden preguntas distintas y no deben confundirse.

## Marcadores y eventos

Los partidos nuevos pueden usar dos modos:

- **events:** el marcador se deriva de los goles estructurados registrados en el centro de partido.
- **manual:** permite conservar partidos históricos o corregir resultados cuando no existe detalle completo de eventos.

El control de integridad distingue ambos casos para evitar falsos positivos.

## Seguridad

Firestore mantiene lectura pública del archivo deportivo y escritura administrativa.

ChuteMundo 6 reconoce roles mediante claims de Firebase:

- `admin: true`
- o `role: "admin"`

Durante la transición se conserva el acceso administrativo histórico como mecanismo de compatibilidad para evitar bloquear el sistema antes de configurar el claim definitivo.

## Desarrollo

```bash
npm install
npm run dev
```

La aplicación se sirve desde `public/`.

Validaciones:

```bash
npm run audit:v6
npm run check:official
```

Smoke test de navegador:

```bash
npm install --no-save playwright@1.52.0
npx playwright install chromium
npm run smoke:v6
```

## PWA y despliegue

La aplicación se publica como sitio estático en Vercel.

- HTML y `version.js`: revalidación.
- Activos versionados: caché larga.
- Service Worker: shell mínimo + caché runtime.
- `public/version.js`: fuente canónica de versión.

## Compatibilidad histórica

La rama `backup/pre-v6-2026-09-29` conserva el estado completo anterior a la migración v6.

Git mantiene además todas las implementaciones antiguas y experimentos retirados.

## Chute y ChuteMundo

Son productos relacionados pero distintos:

- **Chute:** juego de fútbol/cartas.
- **ChuteMundo:** competición, archivo histórico y estadísticas.

En el juego Chute hay **45 cartas que participan en el juego de fútbol**. El **DT es adicional** y cumple la función de dirección del equipo; no forma parte de esas 45 cartas de juego.
