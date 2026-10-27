@echo off
setlocal
title Time Organizer
cd /d "%~dp0"

set "NODE_BIN="

rem 1. Try node on PATH
where node >nul 2>nul
if not errorlevel 1 set "NODE_BIN=node"

rem 2. Try default Node.js install location
if not defined NODE_BIN if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles%\nodejs\node.exe"

rem 3. Try Program Files (x86)
if not defined NODE_BIN if exist "%ProgramFiles(x86)%\nodejs\node.exe" set "NODE_BIN=%ProgramFiles(x86)%\nodejs\node.exe"

rem 4. Try per-user install location
if not defined NODE_BIN if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "NODE_BIN=%LOCALAPPDATA%\Programs\nodejs\node.exe"

if not defined NODE_BIN (
  echo.
  echo Node.js was not found on this PC.
  echo Install the LTS version from https://nodejs.org/ and run this file again.
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('"%NODE_BIN%" -v') do set NODE_VER=%%v
echo Using Node.js %NODE_VER% ^(%NODE_BIN%^)
echo.

"%NODE_BIN%" "%~dp0server.js"

if errorlevel 1 (
  echo.
  echo The server stopped with an error. See the messages above.
  pause
)
endlocal
