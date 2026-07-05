# Publicador automático de GitHub — Chute Mundo

El archivo `Subir_Chute_Mundo_a_GitHub.bat` permite publicar los cambios del proyecto en GitHub sin abrir una terminal manualmente.

## Uso

1. Extrae el ZIP de esta versión.
2. Copia **todos los archivos** a la carpeta local original de Chute Mundo, reemplazando los existentes.
3. Mantén la carpeta oculta `.git` que ya existe en tu proyecto original. No la reemplaces ni la elimines.
4. Haz doble clic en `Subir_Chute_Mundo_a_GitHub.bat`.
5. Escribe un mensaje breve para el cambio o presiona Enter para usar `Actualizacion Chute Mundo`.
6. Espera a que aparezca el mensaje `LISTO: los cambios se subieron correctamente`.

Vercel debería detectar el commit de GitHub y publicar la nueva versión de `chutemundo.vercel.app` automáticamente.

## Qué verifica el script

- que Git esté instalado;
- que se ejecute dentro de una carpeta conectada a GitHub;
- que exista un remoto llamado `origin`;
- si hay cambios reales antes de crear un commit;
- si la rama actual necesita configurar su upstream.

## Errores habituales

### “Git no está instalado”
Instala **Git for Windows** y vuelve a abrir el publicador.

### “Esta carpeta no está conectada a un repositorio Git”
Estás ejecutando el archivo desde la carpeta extraída del ZIP. Copia el contenido a tu carpeta original del proyecto —la que contiene la carpeta oculta `.git`— y ejecútalo allí.

### “No hay cambios nuevos para subir”
Git no detecta diferencias respecto del último commit. No es un error.

### Vercel no se actualiza
Confirma que el repositorio correcto siga conectado al proyecto de Vercel y revisa el último deployment desde el panel de Vercel.
