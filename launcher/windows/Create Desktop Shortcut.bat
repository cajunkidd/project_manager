@echo off
setlocal

REM ---------------------------------------------------------------------------
REM  Create a Windows desktop shortcut that launches Project Manager.
REM  Double-clicking the shortcut runs "Start Project Manager.bat".
REM ---------------------------------------------------------------------------

set "REPO_ROOT=%~dp0..\.."
set "LAUNCHER=%~dp0Start Project Manager.bat"
set "ICON=%~dp0project-manager.ico"
set "POWERSHELL=%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe"

if not exist "%LAUNCHER%" (
    echo Could not locate "%LAUNCHER%".
    pause
    exit /b 1
)

set "SHORTCUT_PATH=%USERPROFILE%\Desktop\Project Manager.lnk"

"%POWERSHELL%" -NoProfile -ExecutionPolicy Bypass -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%SHORTCUT_PATH%');" ^
  "$s.TargetPath = '%LAUNCHER%';" ^
  "$s.WorkingDirectory = '%REPO_ROOT%';" ^
  "$s.WindowStyle = 1;" ^
  "$s.Description = 'Launch the internal Project Manager app.';" ^
  "if (Test-Path '%ICON%') { $s.IconLocation = '%ICON%' }" ^
  "$s.Save()"

if errorlevel 1 (
    echo Failed to create the shortcut.
    pause
    exit /b 1
)

echo.
echo  Shortcut created: %SHORTCUT_PATH%
echo  Double-click it to launch Project Manager.
echo.
pause
