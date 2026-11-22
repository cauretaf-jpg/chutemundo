# Chute Mundo v4.1.0 — Editor de grupos de copas

## Nueva función

Al seleccionar el formato **Copa con grupos**, el formulario muestra un editor visual con dos columnas:

- Grupo A;
- Grupo B.

Los equipos seleccionados se distribuyen automáticamente de forma equilibrada y luego pueden reorganizarse antes de crear el torneo.

## Formas de interacción

### Computador

Cada equipo puede arrastrarse:

- de un grupo al otro;
- dentro del mismo grupo para cambiar su posición visual.

### Celular

Cada equipo incluye un botón con flecha para trasladarlo al grupo contrario. Esto evita depender del arrastre táctil, que puede variar entre navegadores móviles.

## Controles adicionales

- **Distribuir automáticamente:** reconstruye grupos equilibrados.
- **Intercambiar grupos:** cambia todo el Grupo A por el Grupo B y viceversa.
- contador de equipos por grupo;
- estado de validación en tiempo real;
- indicación de los cruces de semifinales.

## Validaciones

La copa no puede crearse cuando:

- hay menos de cuatro equipos seleccionados;
- un equipo falta o aparece duplicado;
- un grupo tiene menos de dos equipos;
- la diferencia entre grupos supera un equipo.

## Generación del fixture

Antes de que el generador de torneos procese los equipos, el editor transforma la distribución elegida en un orden intercalado:

`A1, B1, A2, B2, A3, B3...`

El generador existente separa las posiciones pares e impares, por lo que obtiene exactamente:

- Grupo A: `A1, A2, A3...`;
- Grupo B: `B1, B2, B3...`.

De este modo se conserva la compatibilidad con:

- tablas por grupo;
- partidos de ida o ida y vuelta;
- semifinal 1: primero del Grupo A contra segundo del Grupo B;
- semifinal 2: primero del Grupo B contra segundo del Grupo A;
- partido por el tercer lugar;
- final.

## Pruebas automáticas

La prueba de navegador:

1. selecciona seis equipos;
2. verifica la distribución automática 3–3;
3. arrastra un equipo de A hacia B;
4. comprueba que la distribución 2–4 sea rechazada;
5. devuelve un equipo usando el botón móvil;
6. verifica que la distribución vuelva a ser válida;
7. comprueba que el orden entregado al generador coincida con los grupos elegidos.
