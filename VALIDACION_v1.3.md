# Validación técnica — Chute Mundo v1.3

Fecha: 5 de julio de 2026.

## Archivos revisados

- `app.js`
- `data.js`
- `storage.js`
- `supabaseClient.js`
- `index.html`
- `styles.css`

## Comprobaciones ejecutadas

```text
node --check app.js
node --check data.js
node --check storage.js
node --check supabaseClient.js
```

Resultado: sin errores de sintaxis.

## Pruebas lógicas realizadas

1. Copa con grupos, 4 equipos:
   - distribución en Grupo A y Grupo B;
   - 2 partidos de grupo;
   - semifinales, tercer lugar y final.

2. Copa con grupos, 6 equipos:
   - grupos equilibrados de 3 y 3;
   - 6 partidos de grupo;
   - semifinales, tercer lugar y final.

3. Eliminación directa, 6 equipos:
   - generación de cuartos y semifinales;
   - equipos presentes en cruces iniciales;
   - llave final dependiente de resultados.

4. Compatibilidad:
   - reconstrucción de `teamIds` para torneos antiguos si el arreglo se encuentra vacío, usando grupos y partidos existentes sin alterar marcadores.

## Límites de esta validación

La prueba automatizada cubre la generación y las estructuras de los torneos. La revisión visual final debe hacerse abriendo `index.html` o la publicación de Vercel en un navegador, especialmente en vista móvil.
