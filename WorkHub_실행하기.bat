@echo off
title WorkHub Runner

echo ===================================================
echo   Starting WorkHub Runner...
echo ===================================================

if not exist node_modules (
    echo [INFO] node_modules folder not found.
    echo [INFO] Installing required libraries. Please wait...
    echo.
    call npm install
    echo.
    echo [INFO] Installation completed.
) else (
    echo [INFO] node_modules already exists. Skipping installation.
)

echo.
echo [INFO] Starting WorkHub server...
echo ===================================================
node server.js

pause
