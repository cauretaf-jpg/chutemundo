# Supabase - Chutemundo v1.2

Esta versión deja la app preparada para Supabase, pero mantiene el guardado local como base segura.

## Flujo recomendado

1. Crea un proyecto en Supabase.
2. Abre SQL Editor.
3. Ejecuta `supabase/schema.sql`.
4. Para una prueba privada, puedes ejecutar también `supabase/schema_demo_no_publicar.sql`.
5. En la app, entra a **Admin > Supabase - Preparación para Nube**.
6. Pega `Project URL` y `anon key`.
7. Mantén la tabla como `chutemundo_app_states` y la clave como `main`.
8. Presiona **Conectar Supabase**.
9. Presiona **Subir respaldo actual**.

## Advertencia

La anon key no es una contraseña secreta. La seguridad debe estar en las políticas RLS de Supabase.
El archivo `schema_demo_no_publicar.sql` sirve solo para probar en privado. No conviene dejarlo activo si la app quedará pública.

## Próxima etapa recomendada

Para producción real conviene agregar Supabase Auth y guardar `owner_id` en la tabla. Así cada usuario solo podrá modificar sus propios datos.
