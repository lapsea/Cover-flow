@echo off
cd /d "%~dp0"

where node >nul 2>nul
if %errorlevel% neq 0 (
  echo Node.js is not installed. Please install it from https://nodejs.org
  pause
  exit /b 1
)

REM Stop any previous instance listening on port 3000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
  taskkill /F /PID %%a >nul 2>nul
)

echo Starting Cover-flow...
start "Cover-flow server" cmd /k npm start
timeout /t 2 /nobreak >nul
start http://localhost:3000
