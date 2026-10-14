@echo off
setlocal
cd /d "%~dp0"
title APEX Stage 4 - Local Workspace
node -e "const v=process.versions.node.split('.').map(Number);process.exit(v[0]>22||(v[0]===22&&v[1]>=13)?0:1)"
if errorlevel 1 (
  echo Install Node.js 22.13 or newer, then run Start.bat again.
  pause
  exit /b 1
)
if not exist ".env.local" (
  copy ".env.example" ".env.local" >nul
  echo Created .env.local. Add your GEMINI_API_KEY to it, save, then continue.
  notepad ".env.local"
  pause
)
echo Installing the exact project dependencies...
call npm ci --no-audit --no-fund
if errorlevel 1 goto fail
echo Checking the background runtime...
call npm test
if errorlevel 1 goto fail
echo Building the dashboard...
call npm run build
if errorlevel 1 goto fail
echo Starting APEX. Keep this window open.
call npm run launch
if errorlevel 1 goto fail
exit /b 0
:fail
echo APEX stopped because a check or process failed. Review the message above.
pause
exit /b 1
