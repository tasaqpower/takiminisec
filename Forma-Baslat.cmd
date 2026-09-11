@echo off
cd /d "%~dp0"
set "FORMA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
if exist "%FORMA_NODE%" (
  "%FORMA_NODE%" scripts/start-forma.mjs
) else (
  node scripts/start-forma.mjs
)
if errorlevel 1 pause
