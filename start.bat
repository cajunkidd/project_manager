@echo off
setlocal EnableExtensions
title Project Manager

echo.
echo === Project Manager launcher ===
echo.

REM Detect UNC / network-share location. CMD cannot use UNC paths as the
REM current directory, so we use pushd which maps a temporary drive letter.
set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~0,2%"=="\\" (
  echo [WARNING] This folder is on a network share:
  echo   %SCRIPT_DIR%
  echo Running a Node.js app from a network/redirected Desktop is very slow
  echo and often blocked by AV or folder-redirection policies.
  echo.
  echo Strongly recommended: move the whole folder to a LOCAL disk, e.g.
  echo   C:\Users\%USERNAME%\project_manager
  echo and run start.bat from there.
  echo.
  echo Attempting to continue anyway via a temporary drive mapping...
  echo.
)

pushd "%SCRIPT_DIR%" || (
  echo [ERROR] Could not switch to the script directory:
  echo   %SCRIPT_DIR%
  echo Move the folder to a local disk ^(e.g. C:\Users\%USERNAME%\project_manager^)
  echo and try again.
  pause
  exit /b 1
)

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
popd
goto :eof

:fail
echo.
echo [ERROR] Setup failed. Scroll up to see the cause.
echo.
popd
pause
exit /b 1
