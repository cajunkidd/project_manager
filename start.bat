@echo off
setlocal EnableExtensions
title Project Manager
cd /d "%~dp0"

echo.
echo === Project Manager launcher ===
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not installed or not on PATH.
  echo Install the LTS from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run: installing dependencies. This takes 1-3 minutes...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist "backend\.env" (
  echo Creating backend\.env from example...
  copy /Y "backend\.env.example" "backend\.env" >nul
)

if not exist "backend\dev.db" (
  echo Initializing local database...
  pushd backend
  call npx prisma db push
  set "RC=%ERRORLEVEL%"
  popd
  if not "%RC%"=="0" goto :fail
)

echo.
echo Starting backend (port 4000) and frontend (port 5173)...
echo The browser will open automatically in a few seconds.
echo Press Ctrl+C in this window to stop both servers.
echo.

start "" /min cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:5173"

call npm start
goto :eof

:fail
echo.
echo [ERROR] Setup failed. Scroll up to see the cause.
echo.
pause
exit /b 1
