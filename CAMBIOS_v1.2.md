# Chutemundo v1.2 - Cloud Ready

Versión orientada a preparar la app para Supabase y Vercel sin romper el funcionamiento local.

## Cambios aplicados

- Se retiró Firebase como sistema principal de nube.
- Se agregó `storage.js` como capa de almacenamiento local y respaldos.
- Se agregó `supabaseClient.js` como conector opcional para Supabase usando la REST API, sin depender de librerías externas.
- Se agregó panel de Supabase en la sección Admin.
- Se agregó estado de guardado local y última sincronización nube.
- Se mejoró la exportación JSON con metadatos: app, versión y fecha de exportación.
- Se agregó importación de respaldo desde archivo `.json`.
- Se mantuvo compatibilidad con respaldos antiguos que tenían solo el estado directo.
- Se agregó fallback para escudos personalizados: si Supabase Storage no está disponible, la imagen queda guardada localmente como Data URL.
- Se agregó carpeta `supabase/` con SQL base y SQL demo para pruebas privadas.
- Se agregó documentación para Supabase y Vercel.
- Se agregó `package.json` y `vercel.json` para dejar el proyecto más listo para despliegue.

## Importante

La sincronización con Supabase queda preparada, pero para producción real falta definir autenticación y políticas RLS por usuario/administrador.
