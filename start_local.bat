@echo off
echo Starting Backend...
start "Backend" cmd /k "cd backend && start.bat"
timeout /t 3 /nobreak >nul
echo Starting Frontend...
yarn install
yarn dev

