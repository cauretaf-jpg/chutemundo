@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
title Chute Mundo - Publicar en GitHub

cls
echo ==================================================
echo       CHUTE MUNDO - SUBIR CAMBIOS A GITHUB
echo ==================================================
echo.
echo Carpeta del proyecto:
echo %CD%
echo.

where git >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git no esta instalado o no esta disponible en Windows.
    echo Instala Git for Windows y vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
    echo ERROR: Esta carpeta no esta conectada a un repositorio Git.
    echo.
    echo Para usar este publicador, copia este archivo dentro de la carpeta
    echo original del proyecto que ya subes a GitHub. No lo ejecutes desde
    echo una carpeta extraida sin la carpeta oculta .git.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%B in ('git branch --show-current') do set "BRANCH=%%B"
if "%BRANCH%"=="" (
    echo ERROR: No se pudo identificar la rama actual de Git.
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%R in ('git remote get-url origin 2^>nul') do set "REMOTE=%%R"
if "%REMOTE%"=="" (
    echo ERROR: Este proyecto no tiene un remoto llamado origin.
    echo Configura primero la conexion entre Git y tu repositorio de GitHub.
    echo.
    pause
    exit /b 1
)

echo Rama actual: %BRANCH%
echo Repositorio remoto: %REMOTE%
echo.
echo Revisando cambios...
git status --short
echo.

set "MENSAJE="
set /p "MENSAJE=Mensaje del commit (Enter = Actualizacion Chute Mundo): "
if "%MENSAJE%"=="" set "MENSAJE=Actualizacion Chute Mundo"

echo.
echo Agregando cambios...
git add -A
if errorlevel 1 goto :git_error

git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo No hay cambios nuevos para subir.
    echo.
    pause
    exit /b 0
)

echo Creando commit...
git commit -m "%MENSAJE%"
if errorlevel 1 goto :git_error

echo.
echo Subiendo cambios a GitHub...
git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >nul 2>&1
if errorlevel 1 (
    git push -u origin "%BRANCH%"
) else (
    git push
)
if errorlevel 1 goto :git_error

echo.
echo ==================================================
echo  LISTO: los cambios se subieron correctamente.
echo  Vercel deberia iniciar una nueva publicacion.
echo ==================================================
echo.
pause
exit /b 0

:git_error
echo.
echo ==================================================
echo  No se pudieron subir los cambios.
echo  Revisa el mensaje de Git mostrado arriba.
echo ==================================================
echo.
pause
exit /b 1
