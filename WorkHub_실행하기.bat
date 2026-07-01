@echo off
title WorkHub 서버 실행기
echo ===================================================
echo           WorkHub 업무 관리 시스템 시작
echo ===================================================
echo.
echo 서버를 구동 중입니다. 잠시만 기다려주세요...

:: 로컬에 node.exe가 있으면 그것을 사용, 없으면 시스템 설치된 node 사용
if exist "node.exe" (
    .\node.exe server.js
) else (
    node server.js
)

if %errorlevel% neq 0 (
    echo.
    echo [에러] Node.js가 설치되어 있지 않거나 실행 중 문제가 발생했습니다.
    echo Node.js(https://nodejs.org)를 설치하신 후 다시 실행해주세요.
    pause
)
