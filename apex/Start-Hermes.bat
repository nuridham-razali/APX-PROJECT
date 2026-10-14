@echo off
set "HERMES_HOME=%~dp0.apex-data\hermes-home"
if not exist "%HERMES_HOME%\bin\hermes.cmd" (
  echo Hermes is not installed in this project.
  exit /b 1
)
call "%HERMES_HOME%\bin\hermes.cmd" gateway
