@echo off
setlocal enabledelayedexpansion
title Project Manager

REM ---------------------------------------------------------------------------
REM  Start Project Manager
REM  This launcher boots the backend (which serves the built frontend) and
REM  opens it in the default web browser. On first run it installs npm
REM  dependencies, generates the Prisma client, and creates the database.
REM ---------------------------------------------------------------------------

set "REPO_ROOT=%~dp0..\.."
pushd "%REPO_ROOT%" >nul

REM Resolve PowerShell once for shortcut creation
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

REM ---------------------------------------------------------------------------
REM  Step 1 — verify Node.js
REM ---------------------------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is required but was not found on PATH.
    echo  Install the LTS build from https://nodejs.org and run this launcher again.
    echo.
    pause
    popd >nul
    exit /b 1
)

REM ---------------------------------------------------------------------------
REM  Step 2 — environment defaults
REM ---------------------------------------------------------------------------
if "%PROJECT_MANAGER_PORT%"=="" set "PROJECT_MANAGER_PORT=4000"
set "PORT=%PROJECT_MANAGER_PORT%"
set "NODE_ENV=production"
set "OPEN_BROWSER=1"
if "%DATABASE_URL%"=="" set "DATABASE_URL=file:./project-manager.db"
if "%JWT_SECRET%"=="" set "JWT_SECRET=change-me-in-production"

REM ---------------------------------------------------------------------------
REM  Step 3 — first-run bootstrap
REM ---------------------------------------------------------------------------
set "BOOTSTRAP_MARKER=%REPO_ROOT%\.launcher-bootstrapped"
if not exist "%BOOTSTRAP_MARKER%" (
    echo Setting up Project Manager for first use. This may take a few minutes...
    call npm install --no-audit --no-fund
    if errorlevel 1 goto bootstrap_failed

    pushd backend >nul
    call npx prisma generate
    if errorlevel 1 ( popd >nul & goto bootstrap_failed )
    call npx prisma db push --skip-generate
    if errorlevel 1 ( popd >nul & goto bootstrap_failed )
    popd >nul

    call npm run build
    if errorlevel 1 goto bootstrap_failed

    > "%BOOTSTRAP_MARKER%" echo bootstrapped %DATE% %TIME%
    echo First-run setup complete.
    echo.
)

REM ---------------------------------------------------------------------------
REM  Step 4 — make sure DB schema is current on every launch
REM ---------------------------------------------------------------------------
pushd backend >nul
call npx prisma db push --skip-generate >nul 2>nul
popd >nul

REM ---------------------------------------------------------------------------
REM  Step 5 — start the server
REM ---------------------------------------------------------------------------
echo.
echo  Project Manager is starting on http://localhost:%PORT%
echo  Close this window to stop the server.
echo.
pushd backend >nul
if exist "dist\src\server.js" (
    node dist\src\server.js
) else (
    node dist\server.js
)
set "EXIT_CODE=%ERRORLEVEL%"
popd >nul

popd >nul
exit /b %EXIT_CODE%

:bootstrap_failed
echo.
echo  First-run setup failed. See messages above.
echo.
pause
popd >nul
exit /b 1
