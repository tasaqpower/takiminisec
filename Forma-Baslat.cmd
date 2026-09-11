@echo off
setlocal
cd /d "%~dp0"
title Forma Belge Atolyesi

set "NODE_EXE="
if exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
  set "NODE_EXE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
) else (
  for %%P in (node.exe) do set "NODE_EXE=%%~$PATH:P"
)

if not defined NODE_EXE (
  echo.
  echo [HATA] Node.js bulunamadi!
  echo Lutfen Node.js v22 veya uzerini yukleyin: https://nodejs.org/
  echo.
  pause
  exit /b 1
)

"%NODE_EXE%" scripts/start-forma.mjs
if errorlevel 1 (
  echo.
  echo [BILGI] Baslatma sirasinda bir hata olustu.
  pause
)
