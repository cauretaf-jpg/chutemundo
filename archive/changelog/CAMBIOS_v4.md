# Chute Mundo v4.0.0

## Objetivo

La versión 4 corrige el bloqueo que impedía crear torneos y vuelve a incorporar el nivel completo de detalle competitivo de Chute Mundo, manteniendo Firebase como base compartida.

## Corrección de creación de torneos

La versión anterior exigía simultáneamente:

- una sesión administradora válida;
- Firebase cargado;
- y un indicador interno de historial completo.

Si la migración histórica quedaba parcial, el formulario permanecía bloqueado aunque la sesión fuese correcta.

En v4:

- la edición se habilita con sesión administradora y conexión Firebase;
- el torneo se guarda localmente antes de intentar la escritura remota;
- la escritura en Firebase se espera y verifica explícitamente;
- cualquier rechazo muestra el código o mensaje real;
- Administración incluye una prueba de escritura sin modificar resultados;
- el formulario indica si la creación está habilitada y cuántos equipos están seleccionados.

## Protección de datos

La base remota y el historial original se fusionan por identificador. El proceso:

- conserva los torneos creados posteriormente;
- incorpora únicamente equipos, partidos o estadísticas históricas faltantes;
- evita que una reparación reemplace información reciente;
- mantiene un respaldo local mientras Firebase no está disponible;
- permite exportar e importar el estado completo en JSON.

## Editor completo de partidos

Cada partido permite registrar:

- marcador;
- penales;
- fecha;
- hora;
- sede o cancha;
- observaciones;
- goleador;
- asistidor;
- minuto del gol;
- tarjeta amarilla;
- tarjeta roja;
- minuto de la tarjeta;
- tarjeta para jugador o director técnico.

Los goles y tarjetas se almacenan como eventos estructurados. El sistema mantiene además compatibilidad con los registros históricos guardados como texto.

## Estadísticas

Los eventos de partido alimentan automáticamente:

- tabla de goleadores;
- tabla de asistencias;
- contribuciones G+A;
- amarillas;
- rojas;
- suspensiones;
- fichas de jugadores;
- fichas de equipos;
- resúmenes de partido.

Los acumulados históricos se suman por torneo. Cuando un resultado histórico solo contiene el marcador final, la aplicación no inventa goleadores, asistencias o minutos.

## Recursos visuales

La versión integra los recursos oficiales del proyecto `TorneosChute`:

- seis escudos de equipos;
- 85 rostros de jugadores;
- fichas visuales por club;
- planteles con posición y rendimiento;
- página de jugadores con filtros por nombre, equipo y posición;
- rostros y escudos en rankings, disciplina y editor de partidos.

## Diagnóstico administrativo

Administración informa:

- cuenta autenticada;
- estado de Firebase;
- cantidad de equipos y jugadores;
- cantidad de torneos y partidos;
- goles detallados;
- tarjetas estructuradas;
- resultado de la prueba de escritura;
- opción para revisar y reparar el modelo detallado.

## Validación automática

El workflow `Validate Chute Mundo v4`:

1. reconstruye los seis fragmentos del runtime principal;
2. valida la sintaxis de todos los módulos;
3. comprueba los archivos requeridos;
4. levanta la aplicación localmente;
5. ejecuta una prueba Playwright con Chromium;
6. verifica historial, equipos, más de 80 fichas de jugadores, páginas nuevas y controles completos del editor.

## Dirección oficial

`https://chutemundo.vercel.app`
