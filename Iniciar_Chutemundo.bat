@echo off
cd /d "%~dp0"
echo Iniciando Chutemundo en http://localhost:5173 ...
npx serve . -l 5173
pause
